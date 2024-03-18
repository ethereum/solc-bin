// Tap the JavaScript button at the top
// to switch into Preview mode.

console.info("Console will show a list of log statements");
console.warn("but also output uncaught exceptions.");

// add text one character at a time to simulate interactive writing
function typeText(div, message, len) {
    if(len > message.length) return;
    
    div.innerText = message.substr(0, len);
    setTimeout(function() { typeText(div, message, len + 1); }, 65);
}

// hide source code
var pre = document.getElementsByTagName("pre")[0];
pre.style.display = "none"

// start black & green writer
document.body.style.backgroundColor = "Black";
var div = document.createElement("div");
div.style.whiteSpace = "pre-wrap";
div.style.color = "#37CC64";
document.body.appendChild(div);
typeText(div, "You can use the Javascript Preview mode as a development environment.\n" +
              "            \n" +
              "Enable the Console where you switched mode.", 0);

// tap on exceptions in the log to
// edit at that spot
exceptions_like_this();
