// THE SCYC SCENARIO LIBRARY — the well-known home of every scenario.
//
// One file, every scenario (unlike venues, which get a file each — a scenario
// is small). scenario.html loads this at boot so the library is present
// before any file handle is attached; SAVING writes back to this same file
// once it is attached via the page's File… button (the browser cannot write
// to a path without being handed the file once — after that the handle is
// remembered across sessions).
//
// Emitted as JS, not JSON: the page loads over file://, where fetch is blocked.
// Format: { "<scenario name>": { v, durationS, windKt, boats, marks, sands, lines } }
window.SCENARIO_DOC = {};
