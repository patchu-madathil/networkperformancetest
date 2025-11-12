// script.js - runs ndt7 test and updates the UI
// Requires ndt7 to be loaded globally (from CDN) as in index.html

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

// try to extract throughput (Mbps) from an ndt7 measurement message
function extractMbpsFromData(data) {
  if (!data || !data.Data) return null;

  const d = data.Data;

  // Common: MeanClientMbps or MeanServerMbps
  if (typeof d.MeanClientMbps === 'number') return d.MeanClientMbps;
  if (typeof d.MeanServerMbps === 'number') return d.MeanServerMbps;

  // TCPInfo: compute via BytesSent/ElapsedTime or BytesReceived/ElapsedTime
  if (d.TCPInfo) {
    const t = d.TCPInfo;
    if (typeof t.ElapsedTime === 'number' && t.ElapsedTime > 0) {
      if (typeof t.BytesSent === 'number') {
        return (t.BytesSent * 8) / (t.ElapsedTime * 1e6); // Mbps
      }
      if (typeof t.BytesReceived === 'number') {
        return (t.BytesReceived * 8) / (t.ElapsedTime * 1e6); // Mbps
      }
    }
  }

  return null;
}

// try to extract RTT/latency (ms) from message data
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

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resetUI();
  log('Starting ndt7 test...');

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

    currentTest = ndt7.test(config, callbacks);
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