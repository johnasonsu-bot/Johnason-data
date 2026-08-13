const { errorEnvelope, exitCodeFor, successEnvelope } = require("./envelope");
const { redact } = require("./redaction");

function assertStream(stream, label) {
  if (!stream || typeof stream.write !== "function") throw new TypeError(`${label} must expose write()`);
  return stream;
}

function createRenderer({ json = false, stdout = process.stdout, stderr = process.stderr } = {}) {
  const output = assertStream(stdout, "stdout");
  const diagnostics = assertStream(stderr, "stderr");
  let jsonDocumentEmitted = false;

  function writeJsonDocument(document) {
    if (jsonDocumentEmitted) throw new Error("JSON stdout document already emitted");
    jsonDocumentEmitted = true;
    output.write(`${JSON.stringify(document)}\n`);
  }

  function diagnostic(value) {
    const safeValue = redact(value);
    diagnostics.write(`${typeof safeValue === "string" ? safeValue : JSON.stringify(safeValue)}\n`);
  }

  function success(data, options = {}) {
    const envelope = successEnvelope(data, options);
    if (json) writeJsonDocument(envelope);
    else output.write(`${typeof envelope.data === "string" ? envelope.data : JSON.stringify(envelope.data, null, 2)}\n`);
    return 0;
  }

  function error(failure, auditId = null) {
    const envelope = errorEnvelope(failure, auditId);
    if (json) writeJsonDocument(envelope);
    else diagnostics.write(`${envelope.error.code}: ${envelope.error.message}\n`);
    return exitCodeFor(failure);
  }

  return Object.freeze({ diagnostic, error, success });
}

module.exports = { createRenderer };
