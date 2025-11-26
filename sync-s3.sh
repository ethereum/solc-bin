#!/usr/bin/env bash

#------------------------------------------------------------------------------
# Uploads the content of the local working copy to a storage bucket on
# Amazon S3. Removes any files that do not exist locally. Files in the root
# directory with names starting with a dot or an underscore are not uploaded.
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
# If `sync-r2.sh` is run afterwards the timestamp/cleanup/symlink steps will
# execute again; they are currently idempotent, so keep any additions in this
# area safe to repeat.
#
# WARNING: The script destructively modifies the working copy. Always run it
# on a fresh clone!
#------------------------------------------------------------------------------

set -eo pipefail

die() { >&2 echo "ERROR: $@" && false; }

s3_bucket="$1"
cloudfront_distribution_id="$2"
(( $# == 2 )) || die "Expected exactly 2 parameters."

[[ $(git rev-parse --is-shallow-repository) == false ]] || die "This script requires access to full git history to be able to set file timestamps correctly."

echo "===> Updating file modification timestamps to match commits"
# NOTE: `aws s3 sync` compares file timestamp and size to decide whether to upload it or not.
readarray -t files < <(git ls-files)
for file in "${files[@]}"; do
    full_time="$(git log --max-count 1 --pretty=format:%cd --date=iso -- "$file")"
    unix_timestamp="$(date --date="$full_time" +%Y%m%d%H%M.%S)"
    touch -m -t "$unix_timestamp" "$file"
done

echo "===> Removing files that should not be uploaded to S3"
# NOTE: This ensures that they will be deleted from the bucket if they're already there.
# If we used `aws s3 sync --delete --exclude` instead, they would not get deleted.
find . -path './.*' -delete
find . -path './_*' -delete

echo "===> Adding compatibility symlinks for files containing plus signs in the name"
# NOTE: This is a quick'n'dirty workaround for Amazon S3 decoding plus sign in paths
# as a space even though this substitution is only supposed to happen in a query string.
# See https://forums.aws.amazon.com/thread.jspa?threadID=55746
find . \
    -regex "^\(.*/\)*[^/]*\+[^/]*$" \
    -exec bash -c 'ln --symbolic --no-target-directory "$(basename "{}")" "$(dirname "{}")/$(basename "{}" | tr "+" " ")"' \;

echo "===> Syncing binaries with the S3 bucket"
aws s3 sync . "s3://${s3_bucket}" --delete --follow-symlinks --no-progress --exclude "*/list.*"

echo "===> Syncing file lists with the S3 bucket"
aws s3 sync . "s3://${s3_bucket}" --delete --follow-symlinks --no-progress --exclude "*" --include "*/list.*"

echo "===> Invalidating CloudFront cache"
# Invalidate only the files that might change in-place when new binaries are added.
# NOTE: Invalidation paths allow wildcards only as the last character. When used at
# any other position, AWS will not report an error but will also not invalidate it.
# NOTE: The code below assumes that paths do not contain whitespace.
aws cloudfront create-invalidation \
    --distribution-id "$cloudfront_distribution_id" \
    --paths \
        /bin/soljson-nightly.js \
        /soljson.js \
        $(find . -wholename '*/list.*' | cut --characters 2-) \
        $(find . -wholename '*/*-latest' | cut --characters 2-) \
        $(find . -wholename '*/*-latest.*' | cut --characters 2-)
