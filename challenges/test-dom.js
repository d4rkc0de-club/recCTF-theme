const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "file://" + process.cwd() + "/index.html"
});

dom.window.console.error = console.error;
dom.window.console.log = console.log;
dom.window.console.warn = console.warn;

dom.window.addEventListener('error', (event) => {
  console.error("DOM error:", event.error);
});

setTimeout(() => {
  console.log("Wait complete");
  process.exit(0);
}, 2000);
