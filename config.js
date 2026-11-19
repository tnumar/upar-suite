/* Konfigurasi UPAR Suite.
 * API_URL: URL /exec deployment backend Google Apps Script.
 *   - Semasa pembangunan tempatan (localhost, node dev/server.js) — dikosongkan automatik, guna /api.
 *   - Persekitaran Ujian  : URL /exec akaun personal (di bawah).
 *   - Persekitaran Produksi: tukar kepada URL /exec akaun Workspace USM dan PERSEKITARAN: 'PRODUKSI'.
 */
(function () {
  var tempatan = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  window.UPAR_CONFIG = {
    API_URL: tempatan ? '' : 'https://script.google.com/macros/s/AKfycbwc-JHhy4Y5T_PZmUDDcYAH9eB8JAZ2QoI8DRs80vU2xDEs34H_Oc_2DcnZBDHQpdc/exec',
    PERSEKITARAN: tempatan ? 'PEMBANGUNAN' : 'UJIAN' // PEMBANGUNAN | UJIAN | PRODUKSI (UJIAN/PEMBANGUNAN memaparkan label kecil)
  };
})();
