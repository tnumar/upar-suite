// Senario UAT (Ujian Penerimaan Pengguna). modul = kunci modul; peranan = had peranan (kosong = semua yang ada akses).
// ID senario kekal (rekod keputusan disimpan ikut ID) — tambah senario baharu dengan ID baharu.
export const KUMPULAN = [
  { modul: 'umum', nama: 'Umum', semua: true },
  { modul: 'pergerakan', nama: 'Pergerakan Staf' },
  { modul: 'bukuoff', nama: 'Buku Off' },
  { modul: 'inventori', nama: 'Inventori' },
  { modul: 'dashboard', nama: 'Dashboard' },
  { modul: 'guttae', nama: 'Guttae' },
  { modul: 'formulari', nama: 'Formulari', semua: true },
  { modul: 'penambahbaikan', nama: 'Penambahbaikan', semua: true },
  { modul: 'suite', nama: 'Admin', peranan: ['ADMIN'] }
];

export const SENARIO = [
  { id: 'U1', modul: 'umum', tajuk: 'Log masuk', langkah: 'Log masuk dengan ID staf dan PIN anda.', jangka: 'Halaman Utama dipaparkan dengan nama anda dan modul yang betul.' },
  { id: 'U2', modul: 'umum', tajuk: 'Tukar PIN', langkah: 'Profil → Tukar PIN. Log keluar, kemudian log masuk dengan PIN baharu.', jangka: 'PIN baharu diterima; PIN lama ditolak.' },
  { id: 'U3', modul: 'umum', tajuk: 'Pasang di telefon', langkah: 'Buka app dalam Chrome/Safari telefon → menu → "Tambah ke Skrin Utama". Buka dari ikon.', jangka: 'App dibuka seperti aplikasi biasa tanpa bar alamat.' },
  { id: 'U4', modul: 'umum', tajuk: 'Profil & emel', langkah: 'Profil → semak emel dan peranan anda. Betulkan emel jika perlu dan klik Simpan profil.', jangka: 'Emel disimpan; peranan seperti yang sepatutnya.' },
  { id: 'U5', modul: 'umum', tajuk: 'Paparan & kelajuan', langkah: 'Klik antara menu (Utama, modul lain, Profil) beberapa kali, di komputer dan telefon.', jangka: 'Halaman dibuka dengan lancar, tiada lompat ke halaman lain, teks mudah dibaca.' },

  { id: 'P1', modul: 'pergerakan', tajuk: 'Tambah kod sendiri', langkah: 'Klik satu tarikh pada kalendar → pilih kod (cth CR) → Simpan.', jangka: 'Kod dipaparkan pada tarikh tersebut dengan warna kod.' },
  { id: 'P2', modul: 'pergerakan', tajuk: 'Tambah julat tarikh', langkah: 'Tambah satu kod untuk beberapa hari sekali gus (julat tarikh).', jangka: 'Semua hari dalam julat diisi; hujung minggu dilangkau jika dipilih.' },
  { id: 'P3', modul: 'pergerakan', tajuk: 'Ubah & padam', langkah: 'Klik entri sendiri → ubah kod/catatan → Simpan. Kemudian padam entri itu.', jangka: 'Perubahan disimpan dan entri yang dipadam hilang.' },
  { id: 'P4', modul: 'pergerakan', tajuk: 'Penapis', langkah: 'Guna penapis "Saya sahaja", penapis pasukan (TPN/Kemo/Radio) dan penapis kod.', jangka: 'Hanya staf/kod yang berkaitan dipaparkan.' },
  { id: 'P5', modul: 'pergerakan', tajuk: 'Jadual saya & grid', langkah: 'Tukar ke paparan "Jadual saya" dan paparan grid bulanan.', jangka: 'Semua entri anda dipaparkan dengan betul.' },
  { id: 'P6', modul: 'pergerakan', peranan: ['ADMIN', 'PENYELIA'], tajuk: 'Isi untuk staf lain', langkah: 'Tambah kod untuk seorang staf lain.', jangka: 'Entri disimpan di bawah nama staf itu.' },
  { id: 'P7', modul: 'pergerakan', tajuk: 'Cetak & Excel', langkah: 'Klik Cetak dan Eksport Excel bagi bulan semasa.', jangka: 'Cetakan kemas; fail Excel dibuka dengan data yang betul.' },

  { id: 'B1', modul: 'bukuoff', tajuk: 'Baki sama dengan app lama', langkah: 'Buka Buku Off dan bandingkan baki OFF dengan app lama.', jangka: 'Baki dan senarai rekod sama dengan app lama.' },
  { id: 'B2', modul: 'bukuoff', tajuk: 'Rekod tugasan (+)', langkah: 'Klik Rekod baharu → Tugasan (+) → pilih templat (cth TPN (P)) atau isi masa sendiri → Simpan & hantar.', jangka: 'Rekod berstatus Menunggu; penyelia menerima emel.' },
  { id: 'B3', modul: 'bukuoff', tajuk: 'Rekod ambil Off', langkah: 'Klik Rekod baharu → pilih Off → isi tarikh & masa → Simpan.', jangka: 'Baki berkurang serta-merta (rekod menunggu turut dikira, sama seperti app lama); jika ditolak, baki dipulihkan.' },
  { id: 'B4', modul: 'bukuoff', tajuk: 'Ubah / padam rekod', langkah: 'Klik rekod yang belum disahkan → Ubah, simpan. Kemudian klik rekod itu → Padam.', jangka: 'Perubahan disimpan dan dihantar semula kepada penyelia. Rekod yang sudah disahkan tidak boleh dipadam oleh staf (jika diubah, ia perlu disahkan semula).' },
  { id: 'B5', modul: 'bukuoff', tajuk: 'Cetak buku', langkah: 'Klik Cetak buku.', jangka: 'Cetakan seperti buku rekod off dengan baki berjalan.' },
  { id: 'B6', modul: 'bukuoff', peranan: ['ADMIN', 'PENYELIA'], tajuk: 'Sahkan dalam app', langkah: 'Tab Pengesahan → sahkan satu rekod dan tolak satu rekod (dengan catatan).', jangka: 'Status dikemas kini; staf menerima emel keputusan.' },
  { id: 'B7', modul: 'bukuoff', peranan: ['ADMIN', 'PENYELIA'], tajuk: 'Sahkan melalui emel', langkah: 'Klik pautan pengesahan dalam emel notifikasi.', jangka: 'Rekod boleh disahkan/ditolak tanpa log masuk.' },

  { id: 'I1', modul: 'inventori', tajuk: 'Cari & semak baki', langkah: 'Cari beberapa item (nama/kod/lokasi). Bandingkan baki dengan app lama.', jangka: 'Baki sama (dalam box/pcs yang betul).' },
  { id: 'I2', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS', 'STAF'], tajuk: 'Ambil stok (bakul)', langkah: 'Klik + pada kad item → semak bakul → sahkan keluar.', jangka: 'Baki berkurang; transaksi direkod atas nama anda.' },
  { id: 'I3', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS', 'STAF'], tajuk: 'Terima stok', langkah: 'Klik + Terima → pilih item, kuantiti, tarikh luput, pembekal, No. DO → Simpan.', jangka: 'Baki bertambah; tarikh luput dipaparkan.' },
  { id: 'I4', modul: 'inventori', tajuk: 'Imbas kod', langkah: 'Klik Imbas dan halakan kamera ke kod bar/QR pada label item.', jangka: 'Item yang betul dibuka.' },
  { id: 'I5', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS', 'STAF'], tajuk: 'Ubah / batal transaksi', langkah: 'Tab Transaksi → ubah atau batal transaksi sendiri.', jangka: 'Baki dikira semula dengan betul.' },
  { id: 'I6', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS'], tajuk: 'Urus item', langkah: 'Tambah/ubah item: unit, isi sepek, lokasi, kategori dan foto.', jangka: 'Perubahan dipaparkan pada kad stor.' },
  { id: 'I7', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS'], tajuk: 'Cetak label', langkah: 'Cetak label item pada pelekat 100mm × 50mm.', jangka: 'Label muat pada pelekat; kod bar/QR boleh diimbas.' },
  { id: 'I8', modul: 'inventori', tajuk: 'Kiraan stok', langkah: 'Tab Kiraan stok → mula kiraan, isi kiraan fizikal beberapa item.', jangka: 'Perbezaan dipaparkan; admin boleh sahkan pelarasan.' },
  { id: 'I9', modul: 'inventori', tajuk: 'Ringkasan & laporan', langkah: 'Buka tab Ringkasan dan Laporan; cuba eksport.', jangka: 'Stok rendah/hampir luput dan laporan betul.' },
  { id: 'I10', modul: 'inventori', peranan: ['ADMIN', 'PENGURUS'], tajuk: 'Aktiviti staf', langkah: 'Laporan → Aktiviti staf → Jana (ringkasan). Pilih seorang staf → Jana. Semak juga tab Transaksi untuk rekod yang diubah / dibatalkan.', jangka: 'Bilangan transaksi setiap staf betul; senarai staf menunjukkan siapa terima / keluar / lupus, termasuk siapa yang mengubah atau membatalkan.' },

  { id: 'D1', modul: 'dashboard', peranan: ['ADMIN', 'STAF'], tajuk: 'Preskripsi baharu', langkah: 'Klik + Preskripsi → pilih jenis (TPN/IVA/Kemo), wad, katil, sediaan → Simpan.', jangka: 'Kad preskripsi muncul pada papan.' },
  { id: 'D2', modul: 'dashboard', peranan: ['ADMIN', 'STAF'], tajuk: 'Gerakkan status', langkah: 'Gerakkan preskripsi dari Diterima hingga Sedia diambil.', jangka: 'Status, masa dan TAT dikemas kini.' },
  { id: 'D3', modul: 'dashboard', tajuk: 'Sasaran & ETA', langkah: 'Semak sasaran siap, ETA dan amaran hampir ETA.', jangka: 'Masa sasaran ikut hari bekerja/cuti.' },
  { id: 'D4', modul: 'dashboard', tajuk: 'Ikut wad, Log, Laporan', langkah: 'Buka tab Ikut wad, Log dan Laporan.', jangka: 'Data dan statistik betul.' },
  { id: 'D5', modul: 'dashboard', tajuk: 'Eksport Excel', langkah: 'Klik Excel pada papan.', jangka: 'Fail Excel mengandungi preskripsi hari ini.' },
  { id: 'D6', modul: 'dashboard', peranan: ['ADMIN', 'STAF'], tajuk: 'Tutup hari', langkah: 'Klik Tutup hari pada penghujung hari ujian. Bagi setiap sediaan belum selesai, pilih Kekal / Sedia Diambil / Batal → Sahkan.', jangka: 'Sediaan dikemas kini ikut pilihan; yang Kekal dibawa ke hari esok. Statistik hari itu kekal dalam tab Laporan.' },
  { id: 'D7', modul: 'dashboard', peranan: ['ADMIN', 'STAF'], tajuk: 'Luar talian', langkah: 'Matikan internet, kemas kini status satu preskripsi, kemudian hidupkan semula internet.', jangka: 'Perubahan diselaraskan secara automatik apabila talian pulih.' },
  { id: 'D8', modul: 'dashboard', peranan: ['ADMIN'], tajuk: 'Paparan TV (kiosk)', langkah: 'Admin → Peranti Kiosk → daftar peranti, buka pautan kiosk pada TV.', jangka: 'Papan dipaparkan dan dikemas kini sendiri.' },

  { id: 'G1', modul: 'guttae', peranan: ['ADMIN', 'STAF'], tajuk: 'Kemas kini stok guttae', langkah: 'Tambah atau kurangkan stok satu kelompok guttae.', jangka: 'Bilangan dan tarikh luput dikemas kini.' },
  { id: 'G2', modul: 'guttae', tajuk: 'Amaran luput', langkah: 'Semak kelompok yang hampir luput / luput.', jangka: 'Amaran dipaparkan dengan warna yang betul.' },

  { id: 'F1', modul: 'formulari', tajuk: 'Cari formulasi', langkah: 'Cari formulasi dan buka butirannya.', jangka: 'Maklumat lengkap dan sama dengan IVA Formulary lama.' },
  { id: 'F2', modul: 'formulari', peranan: ['EDITOR'], tajuk: 'Ubah formulasi', langkah: 'Ubah satu formulasi, simpan dan lihat sejarah versi.', jangka: 'Versi baharu direkod; versi lama boleh dipulihkan.' },

  { id: 'N1', modul: 'penambahbaikan', tajuk: 'Rekod penambahbaikan', langkah: 'Penambahbaikan → Rekod penambahbaikan → isi aspek, perihal, sebelum, selepas → tambah 2 gambar → Simpan.', jangka: 'Rekod dipaparkan dengan gambar; boleh diubah dan dipadam oleh anda.' },
  { id: 'N2', modul: 'penambahbaikan', tajuk: 'Kertas kerja', langkah: 'Klik Kertas kerja → pilih satu penambahbaikan → semak draf automatik, betulkan → Simpan & cetak.', jangka: 'Kertas kerja A4 tegak dengan Projek, Permasalahan, Cadangan, Implikasi, gambar & ruang tandatangan; suntingan disimpan.' },
  { id: 'N3', modul: 'penambahbaikan', tajuk: 'Cetak laporan', langkah: 'Klik Cetak laporan → pilih tempoh (cth Januari hingga Jun) → Cetak.', jangka: 'Laporan A4 melintang ikut aspek: Bil, Jenis/Perihal, Sebelum, Selepas dan Diselaraskan oleh.' },
  { id: 'A1', modul: 'suite', tajuk: 'Urus staf', langkah: 'Tambah staf ujian, ubah peranan, kemudian nyahaktifkan.', jangka: 'ID tidak boleh diubah selepas disimpan; staf tidak aktif tidak boleh log masuk.' },
  { id: 'A2', modul: 'suite', tajuk: 'Tetapan', langkah: 'Ubah satu tetapan masa (HH:MM) dan simpan.', jangka: 'Nilai kekal HH:MM selepas simpan.' },
  { id: 'A3', modul: 'suite', tajuk: 'Kod pergerakan & cuti umum', langkah: 'Tambah/ubah kod pergerakan; masukkan cuti umum secara pukal.', jangka: 'Dipaparkan pada kalendar Pergerakan.' },
  { id: 'A4', modul: 'suite', tajuk: 'Templat emel & jenama', langkah: 'Ubah satu templat emel atau warna/nama app.', jangka: 'Perubahan digunakan dalam emel/app.' },

  { id: 'X1', modul: 'umum', tajuk: 'Maklum balas umum', langkah: 'Tulis cadangan, masalah lain atau perkara yang anda suka.', jangka: 'Tiada jawapan betul/salah — tandakan Lulus selepas menulis.', bebas: true }
];

/** Senario yang berkaitan dengan pengguna ini (ikut akses modul & peranan). */
export function senarioSaya(S) {
  const boleh = (x) => {
    const g = KUMPULAN.find((k) => k.modul === x.modul) || {};
    if (g.peranan && !S.ada(g.modul, g.peranan)) return false;
    if (!g.semua && !S.ada(x.modul)) return false;
    if (x.peranan && !S.ada(x.modul, x.peranan)) return false;
    return true;
  };
  return SENARIO.filter(boleh);
}
