#!/usr/bin/env bash

#------------------------------------------------------------------------------
# Uploads the content of the local working copy to the Cloudflare R2 bucket
# using the AWS CLI (S3-compatible API). Removes any files that do not exist
# locally. Files in the root directory with names starting with a dot or an
# underscore are not uploaded. After the upload the Cloudflare CDN cache is
# purged for the affected files.
#
# The script assumes that the AWS CLI tool is installed and already configured
# with credentials allowing it to modify the bucket.
#
# NOTE: There's no built-in mechanism for updating an S3 bucket in an atomic
# way. Only individual file updates are atomic. This means that during the
# sync clients will see the intermediate state with some files missing or not
# yet updated. Since the binaries are never modified or removed from the repository
# under normal circumstances, updating file lists last is enough to alleviate this.
#
# When running multiple instances of this script concurrently on different
# revisions it's theoretically possible to end up with any combination of
# their files in the bucket so it should be avoided.
#
# WARNING: The script destructively modifies the working copy. Always run it
# on a fresh clone!
#------------------------------------------------------------------------------

set -eo pipefail

die() { >&2 echo "ERROR: $@" && false; }

r2_account_id="$1"
r2_zone="$2"
r2_bucket_name="$3"
cloudflare_zone_id="$4"
cloudflare_cache_host="$5"
cloudflare_api_token="$6"

(( $# == 6 )) || die "Expected exactly 6 parameters."

r2_endpoint="https://${r2_account_id}.r2.cloudflarestorage.com"
r2_bucket_uri="s3://${r2_bucket_name}"

echo "===> Using Cloudflare R2 bucket '${r2_bucket_name}' (zone: ${r2_zone}) via account ${r2_account_id}"

[[ $(git rev-parse --is-shallow-repository) == false ]] || die "This script requires access to full git history to be able to set file timestamps correctly."

echo "===> Updating file modification timestamps to match commits"
# NOTE: `aws s3 sync` compares file timestamp and size to decide whether to upload it or not.
readarray -t files < <(git ls-files)
for file in "${files[@]}"; do
    full_time="$(git log --max-count 1 --pretty=format:%cd --date=iso -- "$file")"
    unix_timestamp="$(date --date="$full_time" +%Y%m%d%H%M.%S)"
    touch -m -t "$unix_timestamp" "$file"
done

echo "===> Removing files that should not be uploaded to the bucket"
# NOTE: This ensures that they will be deleted from the bucket if they're already there.
# If we used `aws s3 sync --delete --exclude` instead, they would not get deleted.
find . -path './.*' -delete
find . -path './_*' -delete

# R2 serves keys containing '+' correctly, so we skip the S3-specific symlink workaround that still exists in sync-s3.sh.

echo "===> Syncing binaries with the Cloudflare R2 bucket"
aws --endpoint-url "$r2_endpoint" s3 sync . "$r2_bucket_uri" --delete --follow-symlinks --no-progress --exclude "*/list.*"

echo "===> Syncing file lists with the Cloudflare R2 bucket"
aws --endpoint-url "$r2_endpoint" s3 sync . "$r2_bucket_uri" --delete --follow-symlinks --no-progress --exclude "*" --include "*/list.*"

echo "===> Purging Cloudflare CDN cache"
# Purge only the files that might change in-place when new binaries are added.
purge_paths=(
    "/bin/soljson-nightly.js"
    "/soljson.js"
)
while IFS= read -r path; do
    purge_paths+=("/${path}")
done < <(find . \( -wholename '*/list.*' -o -wholename '*/*-latest' -o -wholename '*/*-latest.*' \) | cut --characters 2-)

purge_payload="$(jq --null-input \
    --arg host "https://${cloudflare_cache_host}" \
    '{"files": ($ARGS.positional | map($host + .))}' \
    --args -- "${purge_paths[@]}"
)"

curl --fail --show-error --silent \
    -X POST "https://api.cloudflare.com/client/v4/zones/${cloudflare_zone_id}/purge_cache" \
    -H "Authorization: Bearer ${cloudflare_api_token}" \
    -H "Content-Type: application/json" \
    --data "$purge_payload"
