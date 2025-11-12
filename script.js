// script.js - runs ndt7 test and updates the UI
// This script waits for window.ndt7 to be available before attempting to use it.

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const serverEl = document.getElementById('server');
const downloadEl = document.getElementById('download');
const uploadEl = document.getElementById('upload');
const latencyEl = document.getElementById('latency');
const logEl = document.getElementById('log');

let currentTest = null;

function log(msg) {
  const time = new Date().toISOString().substr(11, 8);
  logEl.textContent = `[${time}] ${msg}\n` + logEl.textContent;
}

function formatMbps(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(2)} Mb/s`;
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(1)} ms`;
}

function extractMbpsFromData(data) {
  if (!data || !data.Data) return null;
  const d = data.Data;
  if (typeof d.MeanClientMbps === 'number') return d.MeanClientMbps;
  if (typeof d.MeanServerMbps === 'number') return d.MeanServerMbps;
  if (d.TCPInfo) {
    const t = d.TCPInfo;
    if (typeof t.ElapsedTime === 'number' && t.ElapsedTime > 0) {
      if (typeof t.BytesSent === 'number') return (t.BytesSent * 8) / (t.ElapsedTime * 1e6);
      if (typeof t.BytesReceived === 'number') return (t.BytesReceived * 8) / (t.ElapsedTime * 1e6);
    }
  }
  return null;
}

function extractLatencyFromData(data) {
  if (!data || !data.Data) return null;
  const d = data.Data;
  if (typeof d.MinRTTMs === 'number') return d.MinRTTMs;
  if (typeof d.MinRTT === 'number') return d.MinRTT;
  if (typeof d.Latency === 'number') return d.Latency;
  if (d.TCPInfo) {
    const t = d.TCPInfo;
    if (typeof t.RTT === 'number') return t.RTT;
    if (typeof t.rtt === 'number') return t.rtt;
    if (typeof t.SmoothedRTT === 'number') return t.SmoothedRTT;
  }
  return null;
}

function resetUI() {
  serverEl.textContent = 'Not selected';
  downloadEl.textContent = '—';
  uploadEl.textContent = '—';
  latencyEl.textContent = '—';
  logEl.textContent = 'Idle';
}

// Helper that waits for ndt7 for up to timeoutMs
function waitForNdt7(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (window.ndt7) return resolve(window.ndt7);
    const start = Date.now();
    const iv = setInterval(() => {
      if (window.ndt7) {
        clearInterval(iv);
        return resolve(window.ndt7);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        return reject(new Error('ndt7 library not available'));
      }
    }, 150);
  });
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resetUI();
  log('Starting ndt7 test...');

  try {
    // ensure ndt7 is available
    await waitForNdt7(10000);
  } catch (err) {
    log('ndt7 library did not load: ' + err.message);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    return;
  }

  try {
    const config = {
      userAcceptedDataPolicy: true,
      metadata: { client_name: 'networkperformancetest' }
    };

    const callbacks = {
      serverChosen: (server) => {
        const name = server && (server.machine || server.server) ? (server.machine || server.server) : JSON.stringify(server);
        const location = server && server.location && server.location.city ? ` — ${server.location.city}` : '';
        serverEl.textContent = `${name}${location}`;
        log(`Server chosen: ${name}${location}`);
      },

      downloadMeasurement: (data) => {
        const mbps = extractMbpsFromData(data);
        if (mbps !== null) {
          downloadEl.textContent = formatMbps(mbps);
          log(`Download update: ${formatMbps(mbps)}`);
        }
        const lat = extractLatencyFromData(data);
        if (lat !== null) {
          latencyEl.textContent = formatMs(lat);
          log(`Latency update: ${formatMs(lat)}`);
        }
      },

      uploadMeasurement: (data) => {
        const mbps = extractMbpsFromData(data);
        if (mbps !== null) {
          uploadEl.textContent = formatMbps(mbps);
          log(`Upload update: ${formatMbps(mbps)}`);
        }
        const lat = extractLatencyFromData(data);
        if (lat !== null) {
          latencyEl.textContent = formatMs(lat);
          log(`Latency update: ${formatMs(lat)}`);
        }
      },

      measurement: (data) => {
        log(`Measurement event: ${data && data.Type ? data.Type : 'event'}`);
      },

      error: (err) => {
        console.error('ndt7 error', err);
        log(`Error: ${err && err.message ? err.message : String(err)}`);
      }
    };

    // run test using the globally loaded ndt7
    currentTest = window.ndt7.test(config, callbacks);
    const exitCode = await currentTest;
    log(`ndt7 test completed with exit code ${exitCode}`);
  } catch (err) {
    console.error('Test failed', err);
    log(`Test failed: ${err && err.message ? err.message : String(err)}`);
  } finally {
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

stopBtn.addEventListener('click', () => {
  log('Stop requested. If the ndt7 client supports cancellation it will stop; otherwise wait for completion.');
  startBtn.disabled = false;
  stopBtn.disabled = true;
});