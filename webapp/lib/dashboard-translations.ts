// Dashboard Translations for Restaurant Owners - Bilingual (Primary Language + English)
// Used for Dashboard, Upload, Menus, Settings pages

export type DashboardLanguage = 'th' | 'en' | 'zh' | 'ja' | 'ko' | 'vi' | 'hi' | 'es' | 'fr' | 'de' | 'id' | 'ms';

export const SUPPORTED_LANGUAGES = [
  { code: 'th', name: 'ไทย', nameEn: 'Thai' },
  { code: 'en', name: 'English', nameEn: 'English' },
  { code: 'zh', name: '中文', nameEn: 'Chinese' },
  { code: 'ja', name: '日本語', nameEn: 'Japanese' },
  { code: 'ko', name: '한국어', nameEn: 'Korean' },
  { code: 'vi', name: 'Tiếng Việt', nameEn: 'Vietnamese' },
  { code: 'hi', name: 'हिंदी', nameEn: 'Hindi' },
  { code: 'es', name: 'Español', nameEn: 'Spanish' },
  { code: 'fr', name: 'Français', nameEn: 'French' },
  { code: 'de', name: 'Deutsch', nameEn: 'German' },
  { code: 'id', name: 'Indonesia', nameEn: 'Indonesian' },
  { code: 'ms', name: 'Melayu', nameEn: 'Malay' },
] as const;

// Plan-based language limits
export const PLAN_LANGUAGE_LIMITS: Record<string, number> = {
  free_trial: 2,      // Original + English only
  starter: 2,         // Original + English only
  professional: 5,    // 5 languages
  enterprise: 12,     // All languages
  admin: 12,          // All languages
};

export const dashboardTranslations = {
  // Common
  common: {
    save: { th: 'บันทึก', en: 'Save', zh: '保存', ja: '保存', ko: '저장', vi: 'Lưu', hi: 'सहेजें', es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', id: 'Simpan', ms: 'Simpan' },
    cancel: { th: 'ยกเลิก', en: 'Cancel', zh: '取消', ja: 'キャンセル', ko: '취소', vi: 'Hủy', hi: 'रद्द करें', es: 'Cancelar', fr: 'Annuler', de: 'Abbrechen', id: 'Batal', ms: 'Batal' },
    delete: { th: 'ลบ', en: 'Delete', zh: '删除', ja: '削除', ko: '삭제', vi: 'Xóa', hi: 'हटाएं', es: 'Eliminar', fr: 'Supprimer', de: 'Löschen', id: 'Hapus', ms: 'Padam' },
    edit: { th: 'แก้ไข', en: 'Edit', zh: '编辑', ja: '編集', ko: '편집', vi: 'Chỉnh sửa', hi: 'संपादित करें', es: 'Editar', fr: 'Modifier', de: 'Bearbeiten', id: 'Edit', ms: 'Edit' },
    add: { th: 'เพิ่ม', en: 'Add', zh: '添加', ja: '追加', ko: '추가', vi: 'Thêm', hi: 'जोड़ें', es: 'Agregar', fr: 'Ajouter', de: 'Hinzufügen', id: 'Tambah', ms: 'Tambah' },
    close: { th: 'ปิด', en: 'Close', zh: '关闭', ja: '閉じる', ko: '닫기', vi: 'Đóng', hi: 'बंद करें', es: 'Cerrar', fr: 'Fermer', de: 'Schließen', id: 'Tutup', ms: 'Tutup' },
    loading: { th: 'กำลังโหลด...', en: 'Loading...', zh: '加载中...', ja: '読み込み中...', ko: '로딩 중...', vi: 'Đang tải...', hi: 'लोड हो रहा है...', es: 'Cargando...', fr: 'Chargement...', de: 'Lädt...', id: 'Memuat...', ms: 'Memuatkan...' },
    success: { th: 'สำเร็จ', en: 'Success', zh: '成功', ja: '成功', ko: '성공', vi: 'Thành công', hi: 'सफलता', es: 'Éxito', fr: 'Succès', de: 'Erfolg', id: 'Berhasil', ms: 'Berjaya' },
    error: { th: 'เกิดข้อผิดพลาด', en: 'Error occurred', zh: '发生错误', ja: 'エラーが発生しました', ko: '오류가 발생했습니다', vi: 'Đã xảy ra lỗi', hi: 'त्रुटि हुई', es: 'Ocurrió un error', fr: 'Une erreur est survenue', de: 'Ein Fehler ist aufgetreten', id: 'Terjadi kesalahan', ms: 'Ralat berlaku' },
    confirm: { th: 'ยืนยัน', en: 'Confirm', zh: '确认', ja: '確認', ko: '확인', vi: 'Xác nhận', hi: 'पुष्टि करें', es: 'Confirmar', fr: 'Confirmer', de: 'Bestätigen', id: 'Konfirmasi', ms: 'Sahkan' },
    back: { th: 'กลับ', en: 'Back', zh: '返回', ja: '戻る', ko: '뒤로', vi: 'Quay lại', hi: 'वापस', es: 'Volver', fr: 'Retour', de: 'Zurück', id: 'Kembali', ms: 'Kembali' },
    next: { th: 'ถัดไป', en: 'Next', zh: '下一个', ja: '次へ', ko: '다음', vi: 'Tiếp theo', hi: 'आगे', es: 'Siguiente', fr: 'Suivant', de: 'Weiter', id: 'Selanjutnya', ms: 'Seterusnya' },
    search: { th: 'ค้นหา', en: 'Search', zh: '搜索', ja: '検索', ko: '검색', vi: 'Tìm kiếm', hi: 'खोजें', es: 'Buscar', fr: 'Rechercher', de: 'Suchen', id: 'Cari', ms: 'Cari' },
    all: { th: 'ทั้งหมด', en: 'All', zh: '全部', ja: 'すべて', ko: '전체', vi: 'Tất cả', hi: 'सभी', es: 'Todos', fr: 'Tous', de: 'Alle', id: 'Semua', ms: 'Semua' },
    yes: { th: 'ใช่', en: 'Yes', zh: '是', ja: 'はい', ko: '예', vi: 'Có', hi: 'हां', es: 'Sí', fr: 'Oui', de: 'Ja', id: 'Ya', ms: 'Ya' },
    no: { th: 'ไม่', en: 'No', zh: '否', ja: 'いいえ', ko: '아니오', vi: 'Không', hi: 'नहीं', es: 'No', fr: 'Non', de: 'Nein', id: 'Tidak', ms: 'Tidak' },
  },

  // Navigation
  nav: {
    dashboard: { th: 'แดชบอร์ด', en: 'Dashboard', zh: '仪表板', ja: 'ダッシュボード', ko: '대시보드', vi: 'Bảng điều khiển', hi: 'डैशबोर्ड', es: 'Panel', fr: 'Tableau de bord', de: 'Dashboard', id: 'Dasbor', ms: 'Papan Pemuka' },
    upload: { th: 'อัปโหลด', en: 'Upload', zh: '上传', ja: 'アップロード', ko: '업로드', vi: 'Tải lên', hi: 'अपलोड', es: 'Subir', fr: 'Télécharger', de: 'Hochladen', id: 'Unggah', ms: 'Muat Naik' },
    myMenu: { th: 'เมนูของฉัน', en: 'My Menu', zh: '我的菜单', ja: 'マイメニュー', ko: '내 메뉴', vi: 'Menu của tôi', hi: 'मेरा मेनू', es: 'Mi Menú', fr: 'Mon Menu', de: 'Mein Menü', id: 'Menu Saya', ms: 'Menu Saya' },
    orders: { th: 'ออเดอร์', en: 'Orders', zh: '订单', ja: '注文', ko: '주문', vi: 'Đơn hàng', hi: 'ऑर्डर', es: 'Pedidos', fr: 'Commandes', de: 'Bestellungen', id: 'Pesanan', ms: 'Pesanan' },
    settings: { th: 'ตั้งค่า', en: 'Settings', zh: '设置', ja: '設定', ko: '설정', vi: 'Cài đặt', hi: 'सेटिंग्स', es: 'Configuración', fr: 'Paramètres', de: 'Einstellungen', id: 'Pengaturan', ms: 'Tetapan' },
    backToDashboard: { th: 'กลับหน้าหลัก', en: 'Back to Dashboard', zh: '返回仪表板', ja: 'ダッシュボードに戻る', ko: '대시보드로 돌아가기', vi: 'Quay lại bảng điều khiển', hi: 'डैशबोर्ड पर वापस जाएं', es: 'Volver al Panel', fr: 'Retour au tableau de bord', de: 'Zurück zum Dashboard', id: 'Kembali ke Dasbor', ms: 'Kembali ke Papan Pemuka' },
  },

  // Dashboard Page
  dashboard: {
    title: { th: 'แดชบอร์ด', en: 'Dashboard', zh: '仪表板', ja: 'ダッシュボード', ko: '대시보드', vi: 'Bảng điều khiển', hi: 'डैशबोर्ड', es: 'Panel', fr: 'Tableau de bord', de: 'Dashboard', id: 'Dasbor', ms: 'Papan Pemuka' },
    welcome: { th: 'ยินดีต้อนรับ', en: 'Welcome', zh: '欢迎', ja: 'ようこそ', ko: '환영합니다', vi: 'Chào mừng', hi: 'स्वागत है', es: 'Bienvenido', fr: 'Bienvenue', de: 'Willkommen', id: 'Selamat datang', ms: 'Selamat datang' },
    quickStats: { th: 'สถิติด่วน', en: 'Quick Stats', zh: '快速统计', ja: 'クイック統計', ko: '빠른 통계', vi: 'Thống kê nhanh', hi: 'त्वरित आँकड़े', es: 'Estadísticas rápidas', fr: 'Statistiques rapides', de: 'Schnelle Statistiken', id: 'Statistik Cepat', ms: 'Statistik Pantas' },
    totalMenuItems: { th: 'รายการเมนูทั้งหมด', en: 'Total Menu Items', zh: '菜单项总数', ja: '総メニュー数', ko: '총 메뉴 항목', vi: 'Tổng món ăn', hi: 'कुल मेनू आइटम', es: 'Total de elementos del menú', fr: 'Total des éléments du menu', de: 'Gesamte Menüelemente', id: 'Total Item Menu', ms: 'Jumlah Item Menu' },
    totalOrders: { th: 'ออเดอร์ทั้งหมด', en: 'Total Orders', zh: '订单总数', ja: '総注文数', ko: '총 주문', vi: 'Tổng đơn hàng', hi: 'कुल ऑर्डर', es: 'Total de pedidos', fr: 'Total des commandes', de: 'Gesamte Bestellungen', id: 'Total Pesanan', ms: 'Jumlah Pesanan' },
    todayOrders: { th: 'ออเดอร์วันนี้', en: "Today's Orders", zh: '今日订单', ja: '本日の注文', ko: '오늘 주문', vi: 'Đơn hàng hôm nay', hi: 'आज के ऑर्डर', es: 'Pedidos de hoy', fr: "Commandes d'aujourd'hui", de: 'Heutige Bestellungen', id: 'Pesanan Hari Ini', ms: 'Pesanan Hari Ini' },
    revenue: { th: 'รายได้', en: 'Revenue', zh: '收入', ja: '収益', ko: '수익', vi: 'Doanh thu', hi: 'राजस्व', es: 'Ingresos', fr: 'Revenus', de: 'Einnahmen', id: 'Pendapatan', ms: 'Pendapatan' },
    bestSellers: { th: 'สินค้าขายดี', en: 'Best Sellers', zh: '畅销品', ja: '人気商品', ko: '베스트셀러', vi: 'Bán chạy nhất', hi: 'सबसे अधिक बिकने वाले', es: 'Más vendidos', fr: 'Meilleures ventes', de: 'Bestseller', id: 'Terlaris', ms: 'Terlaris' },
    viewQRCode: { th: 'ดู QR Code', en: 'View QR Code', zh: '查看二维码', ja: 'QRコードを見る', ko: 'QR 코드 보기', vi: 'Xem mã QR', hi: 'QR कोड देखें', es: 'Ver código QR', fr: 'Voir le code QR', de: 'QR-Code anzeigen', id: 'Lihat Kode QR', ms: 'Lihat Kod QR' },
    uploadNewMenu: { th: 'อัปโหลดเมนูใหม่', en: 'Upload New Menu', zh: '上传新菜单', ja: '新しいメニューをアップロード', ko: '새 메뉴 업로드', vi: 'Tải lên menu mới', hi: 'नया मेनू अपलोड करें', es: 'Subir nuevo menú', fr: 'Télécharger un nouveau menu', de: 'Neues Menü hochladen', id: 'Unggah Menu Baru', ms: 'Muat Naik Menu Baharu' },
  },

  // Upload Page
  upload: {
    title: { th: 'เพิ่มรายการเมนู', en: 'Add Menu Item', zh: '添加菜单项', ja: 'メニュー項目を追加', ko: '메뉴 항목 추가', vi: 'Thêm món ăn', hi: 'मेनू आइटम जोड़ें', es: 'Agregar elemento del menú', fr: 'Ajouter un élément au menu', de: 'Menüelement hinzufügen', id: 'Tambah Item Menu', ms: 'Tambah Item Menu' },
    menuName: { th: 'ชื่อเมนู', en: 'Menu Name', zh: '菜单名称', ja: 'メニュー名', ko: '메뉴 이름', vi: 'Tên món', hi: 'मेनू नाम', es: 'Nombre del menú', fr: 'Nom du menu', de: 'Menüname', id: 'Nama Menu', ms: 'Nama Menu' },
    description: { th: 'คำอธิบาย', en: 'Description', zh: '描述', ja: '説明', ko: '설명', vi: 'Mô tả', hi: 'विवरण', es: 'Descripción', fr: 'Description', de: 'Beschreibung', id: 'Deskripsi', ms: 'Penerangan' },
    price: { th: 'ราคา', en: 'Price', zh: '价格', ja: '価格', ko: '가격', vi: 'Giá', hi: 'कीमत', es: 'Precio', fr: 'Prix', de: 'Preis', id: 'Harga', ms: 'Harga' },
    category: { th: 'หมวดหมู่', en: 'Category', zh: '分类', ja: 'カテゴリ', ko: '카테고리', vi: 'Danh mục', hi: 'श्रेणी', es: 'Categoría', fr: 'Catégorie', de: 'Kategorie', id: 'Kategori', ms: 'Kategori' },
    photo: { th: 'รูปภาพ', en: 'Photo', zh: '照片', ja: '写真', ko: '사진', vi: 'Ảnh', hi: 'फोटो', es: 'Foto', fr: 'Photo', de: 'Foto', id: 'Foto', ms: 'Foto' },
    meatOptions: { th: 'ตัวเลือกเนื้อ', en: 'Meat Options', zh: '肉类选项', ja: '肉のオプション', ko: '고기 옵션', vi: 'Tùy chọn thịt', hi: 'मांस विकल्प', es: 'Opciones de carne', fr: 'Options de viande', de: 'Fleischoptionen', id: 'Pilihan Daging', ms: 'Pilihan Daging' },
    addOns: { th: 'เพิ่มเติม', en: 'Add-ons', zh: '附加', ja: 'アドオン', ko: '추가 옵션', vi: 'Thêm', hi: 'ऐड-ऑन', es: 'Extras', fr: 'Suppléments', de: 'Extras', id: 'Tambahan', ms: 'Tambahan' },
    bestSeller: { th: 'สินค้าขายดี', en: 'Best Seller', zh: '畅销品', ja: '人気商品', ko: '베스트셀러', vi: 'Bán chạy nhất', hi: 'सबसे अधिक बिकने वाला', es: 'Más vendido', fr: 'Meilleure vente', de: 'Bestseller', id: 'Terlaris', ms: 'Terlaris' },
    generateImage: { th: 'สร้างรูป AI', en: 'Generate AI Image', zh: '生成AI图片', ja: 'AI画像を生成', ko: 'AI 이미지 생성', vi: 'Tạo ảnh AI', hi: 'AI छवि बनाएं', es: 'Generar imagen AI', fr: 'Générer image IA', de: 'AI-Bild erstellen', id: 'Buat Gambar AI', ms: 'Jana Imej AI' },
    enhanceImage: { th: 'ปรับปรุงรูป', en: 'Enhance Image', zh: '增强图片', ja: '画像を強化', ko: '이미지 향상', vi: 'Nâng cao ảnh', hi: 'छवि बढ़ाएं', es: 'Mejorar imagen', fr: 'Améliorer image', de: 'Bild verbessern', id: 'Tingkatkan Gambar', ms: 'Tingkatkan Imej' },
    saveMenu: { th: 'บันทึกเมนู', en: 'Save Menu', zh: '保存菜单', ja: 'メニューを保存', ko: '메뉴 저장', vi: 'Lưu menu', hi: 'मेनू सहेजें', es: 'Guardar menú', fr: 'Enregistrer menu', de: 'Menü speichern', id: 'Simpan Menu', ms: 'Simpan Menu' },
    saving: { th: 'กำลังบันทึก...', en: 'Saving...', zh: '保存中...', ja: '保存中...', ko: '저장 중...', vi: 'Đang lưu...', hi: 'सहेज रहा है...', es: 'Guardando...', fr: 'Enregistrement...', de: 'Speichern...', id: 'Menyimpan...', ms: 'Menyimpan...' },
    menuSaved: { th: 'บันทึกเมนูเรียบร้อยแล้ว!', en: 'Menu saved successfully!', zh: '菜单保存成功！', ja: 'メニューを保存しました！', ko: '메뉴가 저장되었습니다!', vi: 'Đã lưu menu thành công!', hi: 'मेनू सहेजा गया!', es: '¡Menú guardado!', fr: 'Menu enregistré !', de: 'Menü gespeichert!', id: 'Menu disimpan!', ms: 'Menu disimpan!' },
    fillRequired: { th: 'กรุณากรอกข้อมูลที่จำเป็น', en: 'Please fill in required fields', zh: '请填写必填项', ja: '必須項目を入力してください', ko: '필수 항목을 입력하세요', vi: 'Vui lòng điền thông tin bắt buộc', hi: 'कृपया आवश्यक फ़ील्ड भरें', es: 'Por favor complete los campos requeridos', fr: 'Veuillez remplir les champs requis', de: 'Bitte füllen Sie die erforderlichen Felder aus', id: 'Harap isi kolom yang diperlukan', ms: 'Sila isi ruangan yang diperlukan' },
  },

  // Menus Page
  menus: {
    title: { th: 'เมนูของฉัน', en: 'My Menu', zh: '我的菜单', ja: 'マイメニュー', ko: '내 메뉴', vi: 'Menu của tôi', hi: 'मेरा मेनू', es: 'Mi Menú', fr: 'Mon Menu', de: 'Mein Menü', id: 'Menu Saya', ms: 'Menu Saya' },
    subtitle: { th: 'จัดการรายการเมนูทั้งหมดของคุณ', en: 'Manage all your restaurant menu items', zh: '管理您的所有餐厅菜单项', ja: 'すべてのレストランメニューを管理', ko: '모든 레스토랑 메뉴 항목 관리', vi: 'Quản lý tất cả các món trong menu', hi: 'अपने सभी रेस्तरां मेनू आइटम प्रबंधित करें', es: 'Gestiona todos los elementos de tu menú', fr: 'Gérez tous vos éléments de menu', de: 'Verwalten Sie alle Ihre Menüelemente', id: 'Kelola semua item menu Anda', ms: 'Urus semua item menu anda' },
    noMenus: { th: 'ยังไม่มีเมนู', en: 'No menus yet', zh: '暂无菜单', ja: 'メニューがありません', ko: '메뉴가 없습니다', vi: 'Chưa có menu', hi: 'अभी तक कोई मेनू नहीं', es: 'Aún no hay menús', fr: 'Pas encore de menus', de: 'Noch keine Menüs', id: 'Belum ada menu', ms: 'Tiada menu lagi' },
    visibleOnMenu: { th: 'แสดงบนเมนู', en: 'Visible on menu', zh: '在菜单上显示', ja: 'メニューに表示', ko: '메뉴에 표시', vi: 'Hiển thị trên menu', hi: 'मेनू पर दिखाई देता है', es: 'Visible en el menú', fr: 'Visible sur le menu', de: 'Auf dem Menü sichtbar', id: 'Terlihat di menu', ms: 'Kelihatan di menu' },
    hiddenFromMenu: { th: 'ซ่อนจากเมนู', en: 'Hidden from menu', zh: '从菜单隐藏', ja: 'メニューから非表示', ko: '메뉴에서 숨김', vi: 'Ẩn khỏi menu', hi: 'मेनू से छिपा हुआ', es: 'Oculto del menú', fr: 'Caché du menu', de: 'Vom Menü versteckt', id: 'Tersembunyi dari menu', ms: 'Tersembunyi dari menu' },
    confirmDelete: { th: 'ต้องการลบเมนูนี้ใช่หรือไม่?', en: 'Are you sure you want to delete this menu item?', zh: '确定要删除这个菜单项吗？', ja: 'このメニュー項目を削除しますか？', ko: '이 메뉴 항목을 삭제하시겠습니까?', vi: 'Bạn có chắc muốn xóa món này?', hi: 'क्या आप इस मेनू आइटम को हटाना चाहते हैं?', es: '¿Está seguro de que desea eliminar este elemento del menú?', fr: 'Êtes-vous sûr de vouloir supprimer cet élément du menu?', de: 'Sind Sie sicher, dass Sie dieses Menüelement löschen möchten?', id: 'Apakah Anda yakin ingin menghapus item menu ini?', ms: 'Adakah anda pasti mahu memadam item menu ini?' },
    menuDeleted: { th: 'ลบเมนูเรียบร้อยแล้ว', en: 'Menu item deleted successfully', zh: '菜单项删除成功', ja: 'メニュー項目を削除しました', ko: '메뉴 항목이 삭제되었습니다', vi: 'Đã xóa món thành công', hi: 'मेनू आइटम हटा दिया गया', es: 'Elemento del menú eliminado', fr: 'Élément du menu supprimé', de: 'Menüelement gelöscht', id: 'Item menu dihapus', ms: 'Item menu dipadam' },
    menuUpdated: { th: 'อัปเดตเมนูเรียบร้อยแล้ว', en: 'Menu item updated successfully', zh: '菜单项更新成功', ja: 'メニュー項目を更新しました', ko: '메뉴 항목이 업데이트되었습니다', vi: 'Đã cập nhật món thành công', hi: 'मेनू आइटम अपडेट किया गया', es: 'Elemento del menú actualizado', fr: 'Élément du menu mis à jour', de: 'Menüelement aktualisiert', id: 'Item menu diperbarui', ms: 'Item menu dikemas kini' },
  },

  // Settings Page
  settings: {
    title: { th: 'ตั้งค่าร้านอาหาร', en: 'Restaurant Settings', zh: '餐厅设置', ja: 'レストラン設定', ko: '레스토랑 설정', vi: 'Cài đặt nhà hàng', hi: 'रेस्तरां सेटिंग्स', es: 'Configuración del restaurante', fr: 'Paramètres du restaurant', de: 'Restauranteinstellungen', id: 'Pengaturan Restoran', ms: 'Tetapan Restoran' },
    branding: { th: 'แบรนด์', en: 'Branding', zh: '品牌', ja: 'ブランディング', ko: '브랜딩', vi: 'Thương hiệu', hi: 'ब्रांडिंग', es: 'Marca', fr: 'Marque', de: 'Branding', id: 'Branding', ms: 'Penjenamaan' },
    services: { th: 'บริการ', en: 'Services', zh: '服务', ja: 'サービス', ko: '서비스', vi: 'Dịch vụ', hi: 'सेवाएं', es: 'Servicios', fr: 'Services', de: 'Dienste', id: 'Layanan', ms: 'Perkhidmatan' },
    delivery: { th: 'จัดส่ง', en: 'Delivery', zh: '配送', ja: '配達', ko: '배달', vi: 'Giao hàng', hi: 'डिलीवरी', es: 'Entrega', fr: 'Livraison', de: 'Lieferung', id: 'Pengiriman', ms: 'Penghantaran' },
    payments: { th: 'การชำระเงิน', en: 'Payments', zh: '付款', ja: '支払い', ko: '결제', vi: 'Thanh toán', hi: 'भुगतान', es: 'Pagos', fr: 'Paiements', de: 'Zahlungen', id: 'Pembayaran', ms: 'Pembayaran' },
    language: { th: 'ภาษา', en: 'Language', zh: '语言', ja: '言語', ko: '언어', vi: 'Ngôn ngữ', hi: 'भाषा', es: 'Idioma', fr: 'Langue', de: 'Sprache', id: 'Bahasa', ms: 'Bahasa' },
    restaurantName: { th: 'ชื่อร้าน', en: 'Restaurant Name', zh: '餐厅名称', ja: 'レストラン名', ko: '레스토랑 이름', vi: 'Tên nhà hàng', hi: 'रेस्तरां का नाम', es: 'Nombre del restaurante', fr: 'Nom du restaurant', de: 'Restaurantname', id: 'Nama Restoran', ms: 'Nama Restoran' },
    logo: { th: 'โลโก้', en: 'Logo', zh: '标志', ja: 'ロゴ', ko: '로고', vi: 'Logo', hi: 'लोगो', es: 'Logo', fr: 'Logo', de: 'Logo', id: 'Logo', ms: 'Logo' },
    themeColor: { th: 'สีธีม', en: 'Theme Color', zh: '主题颜色', ja: 'テーマカラー', ko: '테마 색상', vi: 'Màu chủ đề', hi: 'थीम रंग', es: 'Color del tema', fr: 'Couleur du thème', de: 'Themenfarbe', id: 'Warna Tema', ms: 'Warna Tema' },
    primaryLanguage: { th: 'ภาษาหลัก', en: 'Primary Language', zh: '主要语言', ja: 'メイン言語', ko: '기본 언어', vi: 'Ngôn ngữ chính', hi: 'प्राथमिक भाषा', es: 'Idioma principal', fr: 'Langue principale', de: 'Hauptsprache', id: 'Bahasa Utama', ms: 'Bahasa Utama' },
    settingsSaved: { th: 'บันทึกการตั้งค่าเรียบร้อยแล้ว', en: 'Settings saved successfully', zh: '设置保存成功', ja: '設定を保存しました', ko: '설정이 저장되었습니다', vi: 'Đã lưu cài đặt thành công', hi: 'सेटिंग्स सहेजी गईं', es: 'Configuración guardada', fr: 'Paramètres enregistrés', de: 'Einstellungen gespeichert', id: 'Pengaturan disimpan', ms: 'Tetapan disimpan' },
  },

  // Customer Menu / Service Request
  customer: {
    callWaiter: { th: 'เรียกพนักงาน', en: 'Call Waiter', zh: '呼叫服务员', ja: 'ウェイターを呼ぶ', ko: '웨이터 호출', vi: 'Gọi nhân viên', hi: 'वेटर को बुलाएं', es: 'Llamar al mesero', fr: 'Appeler le serveur', de: 'Kellner rufen', id: 'Panggil Pelayan', ms: 'Panggil Pelayan' },
    requestSauce: { th: 'ขอซอสเพิ่ม', en: 'Request Sauce', zh: '要酱料', ja: 'ソースをお願いする', ko: '소스 요청', vi: 'Yêu cầu nước sốt', hi: 'सॉस का अनुरोध करें', es: 'Pedir salsa', fr: 'Demander de la sauce', de: 'Soße anfordern', id: 'Minta Saus', ms: 'Minta Sos' },
    requestWater: { th: 'ขอน้ำเพิ่ม', en: 'Request Water', zh: '要水', ja: '水をお願いする', ko: '물 요청', vi: 'Yêu cầu nước', hi: 'पानी का अनुरोध करें', es: 'Pedir agua', fr: "Demander de l'eau", de: 'Wasser anfordern', id: 'Minta Air', ms: 'Minta Air' },
    requestBill: { th: 'ขอเช็คบิล', en: 'Request Bill', zh: '要账单', ja: '会計をお願いする', ko: '계산서 요청', vi: 'Yêu cầu hóa đơn', hi: 'बिल का अनुरोध करें', es: 'Pedir la cuenta', fr: "Demander l'addition", de: 'Rechnung anfordern', id: 'Minta Tagihan', ms: 'Minta Bil' },
    other: { th: 'อื่นๆ', en: 'Other', zh: '其他', ja: 'その他', ko: '기타', vi: 'Khác', hi: 'अन्य', es: 'Otro', fr: 'Autre', de: 'Sonstiges', id: 'Lainnya', ms: 'Lain-lain' },
    tableNumber: { th: 'หมายเลขโต๊ะ', en: 'Table Number', zh: '桌号', ja: 'テーブル番号', ko: '테이블 번호', vi: 'Số bàn', hi: 'टेबल नंबर', es: 'Número de mesa', fr: 'Numéro de table', de: 'Tischnummer', id: 'Nomor Meja', ms: 'Nombor Meja' },
    additionalMessage: { th: 'ข้อความเพิ่มเติม', en: 'Additional Message', zh: '附加信息', ja: '追加メッセージ', ko: '추가 메시지', vi: 'Tin nhắn bổ sung', hi: 'अतिरिक्त संदेश', es: 'Mensaje adicional', fr: 'Message supplémentaire', de: 'Zusätzliche Nachricht', id: 'Pesan Tambahan', ms: 'Mesej Tambahan' },
    sendRequest: { th: 'ส่งคำขอ', en: 'Send Request', zh: '发送请求', ja: 'リクエストを送信', ko: '요청 보내기', vi: 'Gửi yêu cầu', hi: 'अनुरोध भेजें', es: 'Enviar solicitud', fr: 'Envoyer la demande', de: 'Anfrage senden', id: 'Kirim Permintaan', ms: 'Hantar Permintaan' },
    requestSent: { th: 'ส่งคำขอเรียบร้อยแล้ว!', en: 'Request sent successfully!', zh: '请求发送成功！', ja: 'リクエストを送信しました！', ko: '요청이 전송되었습니다!', vi: 'Đã gửi yêu cầu thành công!', hi: 'अनुरोध भेज दिया गया!', es: '¡Solicitud enviada!', fr: 'Demande envoyée !', de: 'Anfrage gesendet!', id: 'Permintaan terkirim!', ms: 'Permintaan dihantar!' },
    selectRequestType: { th: 'กรุณาเลือกประเภทคำขอ', en: 'Please select a request type', zh: '请选择请求类型', ja: 'リクエストタイプを選択してください', ko: '요청 유형을 선택하세요', vi: 'Vui lòng chọn loại yêu cầu', hi: 'कृपया अनुरोध प्रकार चुनें', es: 'Por favor seleccione un tipo de solicitud', fr: 'Veuillez sélectionner un type de demande', de: 'Bitte wählen Sie einen Anfragetyp', id: 'Silakan pilih jenis permintaan', ms: 'Sila pilih jenis permintaan' },
    enterTableNumber: { th: 'กรุณากรอกหมายเลขโต๊ะ', en: 'Please enter table number', zh: '请输入桌号', ja: 'テーブル番号を入力してください', ko: '테이블 번호를 입력하세요', vi: 'Vui lòng nhập số bàn', hi: 'कृपया टेबल नंबर दर्ज करें', es: 'Por favor ingrese el número de mesa', fr: 'Veuillez entrer le numéro de table', de: 'Bitte geben Sie die Tischnummer ein', id: 'Silakan masukkan nomor meja', ms: 'Sila masukkan nombor meja' },
    addToCart: { th: 'เพิ่มลงตะกร้า', en: 'Add to Cart', zh: '加入购物车', ja: 'カートに追加', ko: '장바구니에 추가', vi: 'Thêm vào giỏ hàng', hi: 'कार्ट में डालें', es: 'Agregar al carrito', fr: 'Ajouter au panier', de: 'In den Warenkorb', id: 'Tambah ke Keranjang', ms: 'Tambah ke Troli' },
    viewCart: { th: 'ดูตะกร้า', en: 'View Cart', zh: '查看购物车', ja: 'カートを見る', ko: '장바구니 보기', vi: 'Xem giỏ hàng', hi: 'कार्ट देखें', es: 'Ver carrito', fr: 'Voir le panier', de: 'Warenkorb anzeigen', id: 'Lihat Keranjang', ms: 'Lihat Troli' },
    placeOrder: { th: 'สั่งอาหาร', en: 'Place Order', zh: '下单', ja: '注文する', ko: '주문하기', vi: 'Đặt hàng', hi: 'ऑर्डर दें', es: 'Realizar pedido', fr: 'Passer commande', de: 'Bestellen', id: 'Pesan', ms: 'Buat Pesanan' },
    specialInstructions: { th: 'คำแนะนำพิเศษ', en: 'Special Instructions', zh: '特殊说明', ja: '特別な指示', ko: '특별 지시', vi: 'Hướng dẫn đặc biệt', hi: 'विशेष निर्देश', es: 'Instrucciones especiales', fr: 'Instructions spéciales', de: 'Besondere Anweisungen', id: 'Instruksi Khusus', ms: 'Arahan Khas' },
    yourOrder: { th: 'ออเดอร์ของคุณ', en: 'Your Order', zh: '您的订单', ja: 'ご注文', ko: '주문 내역', vi: 'Đơn hàng của bạn', hi: 'आपका ऑर्डर', es: 'Su pedido', fr: 'Votre commande', de: 'Ihre Bestellung', id: 'Pesanan Anda', ms: 'Pesanan Anda' },
    subtotal: { th: 'รวมย่อย', en: 'Subtotal', zh: '小计', ja: '小計', ko: '소계', vi: 'Tạm tính', hi: 'उप-योग', es: 'Subtotal', fr: 'Sous-total', de: 'Zwischensumme', id: 'Subtotal', ms: 'Jumlah Kecil' },
    total: { th: 'รวมทั้งหมด', en: 'Total', zh: '总计', ja: '合計', ko: '총액', vi: 'Tổng cộng', hi: 'कुल', es: 'Total', fr: 'Total', de: 'Gesamt', id: 'Total', ms: 'Jumlah' },
    chooseMeat: { th: 'เลือกเนื้อ', en: 'Choose Meat', zh: '选择肉类', ja: '肉を選ぶ', ko: '고기 선택', vi: 'Chọn thịt', hi: 'मांस चुनें', es: 'Elegir carne', fr: 'Choisir la viande', de: 'Fleisch wählen', id: 'Pilih Daging', ms: 'Pilih Daging' },
    required: { th: '(จำเป็น)', en: '(Required)', zh: '(必填)', ja: '(必須)', ko: '(필수)', vi: '(Bắt buộc)', hi: '(आवश्यक)', es: '(Requerido)', fr: '(Obligatoire)', de: '(Erforderlich)', id: '(Wajib)', ms: '(Diperlukan)' },
    orderPlaced: { th: 'สั่งอาหารเรียบร้อย!', en: 'Order placed successfully!', zh: '订单已提交！', ja: '注文が完了しました！', ko: '주문이 완료되었습니다!', vi: 'Đặt hàng thành công!', hi: 'ऑर्डर सफलतापूर्वक दे दिया गया!', es: '¡Pedido realizado!', fr: 'Commande passée !', de: 'Bestellung aufgegeben!', id: 'Pesanan berhasil!', ms: 'Pesanan berjaya!' },
    orderFailed: { th: 'สั่งอาหารไม่สำเร็จ กรุณาลองใหม่', en: 'Failed to place order. Please try again.', zh: '下单失败，请重试', ja: '注文に失敗しました。もう一度お試しください', ko: '주문에 실패했습니다. 다시 시도해 주세요', vi: 'Đặt hàng thất bại. Vui lòng thử lại.', hi: 'ऑर्डर देने में विफल। कृपया पुनः प्रयास करें।', es: 'Error al realizar el pedido. Intente de nuevo.', fr: "Échec de la commande. Veuillez réessayer.", de: 'Bestellung fehlgeschlagen. Bitte erneut versuchen.', id: 'Gagal memesan. Silakan coba lagi.', ms: 'Gagal membuat pesanan. Sila cuba lagi.' },
    cart: { th: 'ตะกร้า', en: 'Cart', zh: '购物车', ja: 'カート', ko: '장바구니', vi: 'Giỏ hàng', hi: 'कार्ट', es: 'Carrito', fr: 'Panier', de: 'Warenkorb', id: 'Keranjang', ms: 'Troli' },
    emptyCart: { th: 'ตะกร้าว่าง', en: 'Your cart is empty', zh: '购物车是空的', ja: 'カートは空です', ko: '장바구니가 비어있습니다', vi: 'Giỏ hàng trống', hi: 'कार्ट खाली है', es: 'El carrito está vacío', fr: 'Le panier est vide', de: 'Warenkorb ist leer', id: 'Keranjang kosong', ms: 'Troli kosong' },
    myOrders: { th: 'ออเดอร์ของฉัน', en: 'My Orders', zh: '我的订单', ja: '注文履歴', ko: '내 주문', vi: 'Đơn hàng của tôi', hi: 'मेरे ऑर्डर', es: 'Mis pedidos', fr: 'Mes commandes', de: 'Meine Bestellungen', id: 'Pesanan Saya', ms: 'Pesanan Saya' },
    menuItems: { th: 'รายการเมนู', en: 'Menu Items', zh: '菜单项', ja: 'メニュー', ko: '메뉴 항목', vi: 'Món ăn', hi: 'मेनू आइटम', es: 'Elementos del menú', fr: 'Éléments du menu', de: 'Menüelemente', id: 'Item Menu', ms: 'Item Menu' },
    categories: { th: 'หมวดหมู่', en: 'Categories', zh: '分类', ja: 'カテゴリ', ko: '카테고리', vi: 'Danh mục', hi: 'श्रेणियां', es: 'Categorías', fr: 'Catégories', de: 'Kategorien', id: 'Kategori', ms: 'Kategori' },
    dineIn: { th: 'รับประทานที่ร้าน', en: 'Dine In', zh: '堂食', ja: '店内飲食', ko: '매장 식사', vi: 'Ăn tại chỗ', hi: 'यहाँ खाएं', es: 'Comer aquí', fr: 'Sur place', de: 'Vor Ort essen', id: 'Makan di Tempat', ms: 'Makan di Sini' },
    pickup: { th: 'รับเอง', en: 'Pickup', zh: '自取', ja: 'テイクアウト', ko: '포장', vi: 'Tự lấy', hi: 'पिकअप', es: 'Para llevar', fr: 'À emporter', de: 'Abholen', id: 'Ambil Sendiri', ms: 'Ambil Sendiri' },
    delivery: { th: 'จัดส่ง', en: 'Delivery', zh: '外卖', ja: '配達', ko: '배달', vi: 'Giao hàng', hi: 'डिलीवरी', es: 'Entrega', fr: 'Livraison', de: 'Lieferung', id: 'Pengiriman', ms: 'Penghantaran' },
    selectMeat: { th: 'กรุณาเลือกประเภทเนื้อ', en: 'Please select a meat option', zh: '请选择肉类', ja: '肉の種類を選択してください', ko: '고기 종류를 선택해 주세요', vi: 'Vui lòng chọn loại thịt', hi: 'कृपया मांस का विकल्प चुनें', es: 'Por favor seleccione una opción de carne', fr: 'Veuillez sélectionner une viande', de: 'Bitte wählen Sie eine Fleischsorte', id: 'Silakan pilih jenis daging', ms: 'Sila pilih jenis daging' },
    serviceType: { th: 'ประเภทบริการ', en: 'Service Type', zh: '服务类型', ja: 'サービスタイプ', ko: '서비스 유형', vi: 'Loại dịch vụ', hi: 'सेवा प्रकार', es: 'Tipo de servicio', fr: 'Type de service', de: 'Serviceart', id: 'Jenis Layanan', ms: 'Jenis Perkhidmatan' },
    name: { th: 'ชื่อ', en: 'Name', zh: '姓名', ja: '名前', ko: '이름', vi: 'Tên', hi: 'नाम', es: 'Nombre', fr: 'Nom', de: 'Name', id: 'Nama', ms: 'Nama' },
    phone: { th: 'เบอร์โทร', en: 'Phone', zh: '电话', ja: '電話番号', ko: '전화번호', vi: 'Điện thoại', hi: 'फोन', es: 'Teléfono', fr: 'Téléphone', de: 'Telefon', id: 'Telepon', ms: 'Telefon' },
    address: { th: 'ที่อยู่', en: 'Address', zh: '地址', ja: '住所', ko: '주소', vi: 'Địa chỉ', hi: 'पता', es: 'Dirección', fr: 'Adresse', de: 'Adresse', id: 'Alamat', ms: 'Alamat' },
    pickupTime: { th: 'เวลารับอาหาร', en: 'Pickup Time', zh: '取餐时间', ja: '受取時間', ko: '픽업 시간', vi: 'Thời gian lấy hàng', hi: 'पिकअप समय', es: 'Hora de recogida', fr: 'Heure de retrait', de: 'Abholzeit', id: 'Waktu Pengambilan', ms: 'Masa Pengambilan' },
    deliveryFee: { th: 'ค่าจัดส่ง', en: 'Delivery Fee', zh: '配送费', ja: '配達料金', ko: '배달비', vi: 'Phí giao hàng', hi: 'डिलीवरी शुल्क', es: 'Cargo por entrega', fr: 'Frais de livraison', de: 'Liefergebühr', id: 'Biaya Pengiriman', ms: 'Yuran Penghantaran' },
    gstIncluded: { th: 'รวม GST แล้ว', en: 'GST Included', zh: '含税', ja: 'GST込み', ko: 'GST 포함', vi: 'Bao gồm thuế', hi: 'GST सहित', es: 'GST incluido', fr: 'TVA incluse', de: 'MwSt. inkl.', id: 'Termasuk PPN', ms: 'Termasuk GST' },
    serviceNotAvailable: { th: 'ร้านนี้ยังไม่เปิดให้บริการสั่งอาหารในขณะนี้', en: 'This restaurant is not accepting orders at this time', zh: '该餐厅目前不接受订单', ja: 'このレストランは現在注文を受け付けていません', ko: '이 레스토랑은 현재 주문을 받지 않습니다', vi: 'Nhà hàng hiện không nhận đơn hàng', hi: 'यह रेस्तरां अभी ऑर्डर स्वीकार नहीं कर रहा', es: 'Este restaurante no acepta pedidos en este momento', fr: 'Ce restaurant ne prend pas de commandes pour le moment', de: 'Dieses Restaurant nimmt derzeit keine Bestellungen an', id: 'Restoran ini tidak menerima pesanan saat ini', ms: 'Restoran ini tidak menerima pesanan pada masa ini' },
    confirmOrder: { th: 'ยืนยันการสั่งอาหาร', en: 'Confirm Order', zh: '确认订单', ja: '注文を確認', ko: '주문 확인', vi: 'Xác nhận đơn hàng', hi: 'ऑर्डर की पुष्टि करें', es: 'Confirmar pedido', fr: 'Confirmer la commande', de: 'Bestellung bestätigen', id: 'Konfirmasi Pesanan', ms: 'Sahkan Pesanan' },
    meat: { th: 'เนื้อ', en: 'Meat', zh: '肉类', ja: '肉', ko: '고기', vi: 'Thịt', hi: 'मांस', es: 'Carne', fr: 'Viande', de: 'Fleisch', id: 'Daging', ms: 'Daging' },
    addOns: { th: 'ของเพิ่ม', en: 'Add-ons', zh: '附加', ja: '追加', ko: '추가 옵션', vi: 'Thêm', hi: 'ऐड-ऑन', es: 'Extras', fr: 'Suppléments', de: 'Extras', id: 'Tambahan', ms: 'Tambahan' },
    notes: { th: 'หมายเหตุ', en: 'Notes', zh: '备注', ja: 'メモ', ko: '메모', vi: 'Ghi chú', hi: 'नोट्स', es: 'Notas', fr: 'Notes', de: 'Notizen', id: 'Catatan', ms: 'Nota' },
  },

  // Alerts / Toast Messages
  alerts: {
    success: { th: 'สำเร็จ!', en: 'Success!', zh: '成功！', ja: '成功！', ko: '성공!', vi: 'Thành công!', hi: 'सफलता!', es: '¡Éxito!', fr: 'Succès !', de: 'Erfolg!', id: 'Berhasil!', ms: 'Berjaya!' },
    error: { th: 'เกิดข้อผิดพลาด', en: 'Error occurred', zh: '发生错误', ja: 'エラーが発生しました', ko: '오류가 발생했습니다', vi: 'Đã xảy ra lỗi', hi: 'त्रुटि हुई', es: 'Ocurrió un error', fr: 'Une erreur est survenue', de: 'Ein Fehler ist aufgetreten', id: 'Terjadi kesalahan', ms: 'Ralat berlaku' },
    warning: { th: 'คำเตือน', en: 'Warning', zh: '警告', ja: '警告', ko: '경고', vi: 'Cảnh báo', hi: 'चेतावनी', es: 'Advertencia', fr: 'Avertissement', de: 'Warnung', id: 'Peringatan', ms: 'Amaran' },
    info: { th: 'ข้อมูล', en: 'Information', zh: '信息', ja: '情報', ko: '정보', vi: 'Thông tin', hi: 'जानकारी', es: 'Información', fr: 'Information', de: 'Information', id: 'Informasi', ms: 'Maklumat' },
    confirmAction: { th: 'ยืนยันการดำเนินการ?', en: 'Confirm this action?', zh: '确认此操作？', ja: 'この操作を確認しますか？', ko: '이 작업을 확인하시겠습니까?', vi: 'Xác nhận thao tác này?', hi: 'इस क्रिया की पुष्टि करें?', es: '¿Confirmar esta acción?', fr: 'Confirmer cette action ?', de: 'Diese Aktion bestätigen?', id: 'Konfirmasi tindakan ini?', ms: 'Sahkan tindakan ini?' },
    saved: { th: 'บันทึกเรียบร้อยแล้ว!', en: 'Saved successfully!', zh: '保存成功！', ja: '保存しました！', ko: '저장되었습니다!', vi: 'Đã lưu thành công!', hi: 'सफलतापूर्वक सहेजा गया!', es: '¡Guardado con éxito!', fr: 'Enregistré avec succès !', de: 'Erfolgreich gespeichert!', id: 'Berhasil disimpan!', ms: 'Berjaya disimpan!' },
    deleted: { th: 'ลบเรียบร้อยแล้ว!', en: 'Deleted successfully!', zh: '删除成功！', ja: '削除しました！', ko: '삭제되었습니다!', vi: 'Đã xóa thành công!', hi: 'सफलतापूर्वक हटाया गया!', es: '¡Eliminado con éxito!', fr: 'Supprimé avec succès !', de: 'Erfolgreich gelöscht!', id: 'Berhasil dihapus!', ms: 'Berjaya dipadam!' },
    tryAgain: { th: 'กรุณาลองอีกครั้ง', en: 'Please try again', zh: '请再试一次', ja: 'もう一度お試しください', ko: '다시 시도해 주세요', vi: 'Vui lòng thử lại', hi: 'कृपया पुनः प्रयास करें', es: 'Por favor intente de nuevo', fr: 'Veuillez réessayer', de: 'Bitte versuchen Sie es erneut', id: 'Silakan coba lagi', ms: 'Sila cuba lagi' },
  },
};

// Helper function to get translation with fallback to English
export function dt(category: keyof typeof dashboardTranslations, key: string, lang: DashboardLanguage = 'en'): string {
  const categoryObj = dashboardTranslations[category];
  if (!categoryObj) return key;

  const keyObj = (categoryObj as any)[key];
  if (!keyObj) return key;

  // Return translation for specified language, fallback to English
  return keyObj[lang] || keyObj['en'] || key;
}

// Helper function to get bilingual text (primary + English)
export function dtBilingual(category: keyof typeof dashboardTranslations, key: string, primaryLang: DashboardLanguage): string {
  if (primaryLang === 'en') {
    return dt(category, key, 'en');
  }
  const primary = dt(category, key, primaryLang);
  const english = dt(category, key, 'en');
  if (primary === english) return primary;
  return `${primary} / ${english}`;
}

// Get available languages based on plan
export function getAvailableLanguages(plan: string): typeof SUPPORTED_LANGUAGES[number][] {
  const limit = PLAN_LANGUAGE_LIMITS[plan] || 2;
  return SUPPORTED_LANGUAGES.slice(0, limit);
}

// Check if language is available for plan
export function isLanguageAvailable(lang: DashboardLanguage, plan: string): boolean {
  const available = getAvailableLanguages(plan);
  return available.some(l => l.code === lang);
}
