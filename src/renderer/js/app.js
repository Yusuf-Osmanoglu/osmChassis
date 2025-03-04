// Veritabanı işlemleri için NeDB'yi import ediyoruz
const Datastore = require('nedb');

// Veritabanlarını oluşturuyoruz
const db = {
    products: new Datastore({ filename: 'data/products.db', autoload: true }),
    orders: new Datastore({ filename: 'data/orders.db', autoload: true }),
    tables: new Datastore({ filename: 'data/tables.db', autoload: true }),
    settings: new Datastore({ filename: 'data/settings.db', autoload: true })
};

// Sayfa yönetimi
const pages = {
    order: () => loadOrderPage(),
    payment: () => loadPaymentPage(),
    'add-item': () => loadAddItemPage(),
    stock: () => loadStockPage(),
    settings: () => loadSettingsPage(),
    summary: () => loadSummaryPage()
};

// Sipariş işleme fonksiyonları
let currentOrder = {
    tableId: null,
    items: [],
    total: 0
};

// Masa seçimi
function selectTable(tableId) {
    // Önceki seçili masayı temizle
    document.querySelectorAll('.table-card').forEach(card => {
        card.classList.remove('active-table');
    });

    // Yeni masayı seç
    const tableCard = document.querySelector(`[data-table-id="${tableId}"]`);
    if (tableCard) {
        tableCard.classList.add('active-table');
        currentOrder.tableId = tableId;
        updateActiveOrder();
        loadTableStatus(tableId); // Masa durumunu yükle
    }
}

// Ürün ekleme
function addToOrder(productId) {
    if (!currentOrder.tableId) {
        showMessage('Lütfen önce bir masa seçin', 'error');
        return;
    }

    db.products.findOne({ _id: productId }, (err, product) => {
        if (err || !product) {
            showMessage('Ürün bulunamadı', 'error');
            return;
        }

        if (product.stock <= 0) {
            showMessage('Ürün stokta yok', 'error');
            return;
        }

        // Mevcut siparişte ürün var mı kontrol et
        const existingItem = currentOrder.items.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            currentOrder.items.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }

        // Toplam tutarı güncelle
        currentOrder.total = currentOrder.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        updateActiveOrder();
    });
}

// Aktif siparişi güncelleme
function updateActiveOrder() {
    const activeOrderDiv = document.getElementById('active-order');
    if (!activeOrderDiv) return;

    if (!currentOrder.tableId) {
        activeOrderDiv.innerHTML = '<p>Lütfen bir masa seçin</p>';
        return;
    }

    let html = `
        <div class="mb-3">
            <h4>Sipariş Detayı</h4>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Ürün</th>
                            <th>Adet</th>
                            <th>Fiyat</th>
                            <th>Toplam</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    currentOrder.items.forEach(item => {
        html += `
            <tr>
                <td>${item.name}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="updateItemQuantity('${item.productId}', ${item.quantity - 1})">-</button>
                    ${item.quantity}
                    <button class="btn btn-sm btn-secondary" onclick="updateItemQuantity('${item.productId}', ${item.quantity + 1})">+</button>
                </td>
                <td>${formatPrice(item.price)}</td>
                <td>${formatPrice(item.price * item.quantity)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="removeFromOrder('${item.productId}')">
                        Sil
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-3">
                <h5>Toplam: ${formatPrice(currentOrder.total)}</h5>
                <button class="btn btn-success" onclick="completeOrder()">
                    Siparişi Tamamla
                </button>
            </div>
        </div>
    `;

    activeOrderDiv.innerHTML = html;
}

// Ürün miktarını güncelleme
function updateItemQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromOrder(productId);
        return;
    }

    const item = currentOrder.items.find(item => item.productId === productId);
    if (item) {
        item.quantity = newQuantity;
        currentOrder.total = currentOrder.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );
        updateActiveOrder();
    }
}

// Üründen siparişten çıkarma
function removeFromOrder(productId) {
    currentOrder.items = currentOrder.items.filter(item => item.productId !== productId);
    currentOrder.total = currentOrder.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
    );
    updateActiveOrder();
}

// Siparişi tamamlama
function completeOrder() {
    if (!currentOrder.tableId || currentOrder.items.length === 0) {
        showMessage('Geçersiz sipariş', 'error');
        return;
    }

    db.tables.findOne({ _id: currentOrder.tableId }, (err, table) => {
        if (err || !table) {
            showMessage('Masa bulunamadı', 'error');
            return;
        }

        const order = {
            tableId: currentOrder.tableId,
            tableNumber: table.number,
            items: currentOrder.items,
            total: currentOrder.total,
            status: 'active',
            createdAt: new Date()
        };

        // Siparişi kaydet
        db.orders.insert(order, (err, newOrder) => {
            if (err) {
                showMessage('Sipariş kaydedilirken hata oluştu', 'error');
                return;
            }

            // Masa durumunu güncelle
            db.tables.update(
                { _id: currentOrder.tableId },
                { $set: { status: 'dolu' } },
                {},
                (err) => {
                    if (err) {
                        showMessage('Masa durumu güncellenirken hata oluştu', 'error');
                        return;
                    }

                    // Stok miktarlarını güncelle
                    currentOrder.items.forEach(item => {
                        db.products.update(
                            { _id: item.productId },
                            { $inc: { stock: -item.quantity } }
                        );
                    });

                    showMessage('Sipariş başarıyla kaydedildi');
                    currentOrder = { tableId: null, items: [], total: 0 };
                    loadOrderPage(); // Sayfayı yenile
                }
            );
        });
    });
}

// Ödeme işlemi
function loadPaymentPage() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="table-container">
            <h3>Ödeme</h3>
            <div class="mb-4">
                <h4>Kasiyer Seçimi</h4>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary" onclick="selectCashier('Yusuf')">Yusuf</button>
                    <button type="button" class="btn btn-outline-primary" onclick="selectCashier('Fırat')">Fırat</button>
                    <button type="button" class="btn btn-outline-primary" onclick="selectCashier('Emre')">Emre</button>
                </div>
                <div id="selected-cashier" class="mt-2 text-success"></div>
            </div>
            <div id="payment-tables"></div>
        </div>
    `;
    loadPaymentTables();
}

// Seçili kasiyer
let selectedCashier = null;

// Kasiyer seçimi
function selectCashier(cashier) {
    selectedCashier = cashier;
    // Tüm butonların active class'ını kaldır
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-primary');
    });
    // Seçili butonu active yap
    const selectedBtn = document.querySelector(`.btn-group .btn:nth-child(${['Yusuf', 'Fırat', 'Emre'].indexOf(cashier) + 1})`);
    if (selectedBtn) {
        selectedBtn.classList.remove('btn-outline-primary');
        selectedBtn.classList.add('btn-primary');
    }
    // Seçili kasiyeri göster
    const selectedCashierDiv = document.getElementById('selected-cashier');
    if (selectedCashierDiv) {
        selectedCashierDiv.textContent = `Seçili Kasiyer: ${cashier}`;
    }
}

// Ödeme işlemi
function processPayment(tableId) {
    if (!selectedCashier) {
        showMessage('Lütfen önce kasiyer seçimi yapın', 'error');
        return;
    }

    db.orders.find({ tableId: tableId, status: 'active' }, (err, orders) => {
        if (err) {
            showMessage('Siparişler yüklenirken hata oluştu', 'error');
            return;
        }

        if (orders.length === 0) {
            showMessage('Aktif sipariş bulunamadı', 'error');
            return;
        }

        // Siparişleri ödenmiş olarak işaretle ve kasiyer bilgisini ekle
        db.orders.update(
            { tableId: tableId, status: 'active' },
            { 
                $set: { 
                    status: 'paid', 
                    paidAt: new Date(),
                    cashier: selectedCashier 
                } 
            },
            { multi: true },
            (err) => {
                if (err) {
                    showMessage('Ödeme işlemi sırasında hata oluştu', 'error');
                    return;
                }

                // Masa durumunu güncelle
                db.tables.update(
                    { _id: tableId },
                    { $set: { status: 'boş' } },
                    {},
                    (err) => {
                        if (err) {
                            showMessage('Masa durumu güncellenirken hata oluştu', 'error');
                            return;
                        }

                        showMessage('Ödeme başarıyla tamamlandı');
                        loadPaymentPage(); // Sayfayı yenile
                    }
                );
            }
        );
    });
}

// Sayfa yükleme işlemleri
function loadPage(pageName) {
    const contentDiv = document.getElementById('content');
    const pageLoader = pages[pageName];
    
    if (pageLoader) {
        pageLoader();
    } else {
        contentDiv.innerHTML = '<h2>Sayfa bulunamadı</h2>';
    }
}

// Sipariş sayfası
function loadOrderPage() {
    const contentDiv = document.getElementById('content');
    let html = `
        <div class="row g-4">
            <!-- Sol Bölüm - Masalar -->
            <div class="col-md-3">
                <div class="table-container">
                    <h3>Masalar</h3>
                    <div class="tables-grid" id="tables-grid">
                        <!-- Masalar buraya dinamik olarak yüklenecek -->
                    </div>
                </div>
            </div>

            <!-- Orta Bölüm - Menü -->
            <div class="col-md-6">
                <div class="table-container">
                    <div class="mb-4">
                        <div class="input-group">
                            <input type="text" class="form-control" id="menu-search" 
                                   placeholder="Ürün ara..." onkeyup="filterMenuItems()">
                            <button class="btn btn-outline-secondary" type="button">
                                <i class="bi bi-search"></i>
                            </button>
                        </div>
                    </div>
                    <div class="menu-items-grid" id="menu-items">
                        <!-- Menü öğeleri buraya dinamik olarak yüklenecek -->
                    </div>
                </div>
            </div>

            <!-- Sağ Bölüm - Kategoriler -->
            <div class="col-md-3">
                <div class="table-container">
                    <h3>Kategoriler</h3>
                    <div class="list-group">
                        <button class="list-group-item list-group-item-action active" 
                                onclick="filterByCategory('all')">
                            Tümü
                        </button>
                        <button class="list-group-item list-group-item-action" 
                                onclick="filterByCategory('sicak-icecek')">
                            Sıcak İçecekler
                        </button>
                        <button class="list-group-item list-group-item-action" 
                                onclick="filterByCategory('soguk-icecek')">
                            Soğuk İçecekler
                        </button>
                        <button class="list-group-item list-group-item-action" 
                                onclick="filterByCategory('yiyecek')">
                            Yiyecekler
                        </button>
                        <button class="list-group-item list-group-item-action" 
                                onclick="filterByCategory('tatli')">
                            Tatlılar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alt Bölüm - Aktif Sipariş ve Masa Durumu -->
        <div class="row mt-4">
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Aktif Sipariş</h3>
                    <div id="active-order">
                        <!-- Aktif sipariş detayları buraya yüklenecek -->
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Masa Durumu</h3>
                    <div id="table-status">
                        <!-- Masa durumu detayları buraya yüklenecek -->
                    </div>
                </div>
            </div>
        </div>
    `;
    contentDiv.innerHTML = html;

    // Sayfadaki bileşenleri yükle
    loadTables();
    loadMenuItems();
    updateActiveOrder();
}

// Masaları yükleme
function loadTables() {
    const tablesGrid = document.getElementById('tables-grid');
    db.tables.find({}).sort({ number: 1 }).exec((err, tables) => {
        if (err) {
            console.error('Masa yükleme hatası:', err);
            return;
        }
        
        let html = '';
        tables.forEach(table => {
            const statusClass = table.status === 'dolu' ? 'table-busy' : 'table-free';
            html += `
                <div class="table-card ${statusClass}" data-table-id="${table._id}">
                    <div class="table-number">${table.number}</div>
                    <div class="table-status">${table.status}</div>
                </div>
            `;
        });
        tablesGrid.innerHTML = html;
    });
}

// Menü öğelerini yükleme
function loadMenuItems(category = 'all') {
    const menuDiv = document.getElementById('menu-items');
    const query = category === 'all' ? {} : { category: category };
    
    db.products.find(query).sort({ name: 1 }).exec((err, products) => {
        if (err) {
            console.error('Ürün yükleme hatası:', err);
            return;
        }
        
        let html = '';
        products.forEach(product => {
            html += `
                <div class="menu-item-card" data-product-id="${product._id}" 
                     data-category="${product.category || 'uncategorized'}">
                    <div class="menu-item-image">
                        <img src="${product.image || 'assets/default-product.png'}" 
                             alt="${product.name}">
                    </div>
                    <div class="menu-item-details">
                        <h5>${product.name}</h5>
                        <p class="price">${formatPrice(product.price)}</p>
                        <p class="stock ${product.stock < 10 ? 'low-stock' : ''}">
                            Stok: ${product.stock}
                        </p>
                    </div>
                </div>
            `;
        });
        menuDiv.innerHTML = html || '<p class="text-center">Ürün bulunamadı</p>';
    });
}

// Menü öğelerini filtreleme
function filterMenuItems() {
    const searchText = document.getElementById('menu-search').value.toLowerCase();
    const menuItems = document.querySelectorAll('.menu-item-card');
    
    menuItems.forEach(item => {
        const name = item.querySelector('h5').textContent.toLowerCase();
        if (name.includes(searchText)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Kategori filtreleme
function filterByCategory(category) {
    // Aktif kategori butonunu güncelle
    document.querySelectorAll('.list-group-item').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Ürünleri filtrele
    loadMenuItems(category);
}

// Ödeme için masaları yükleme
function loadPaymentTables() {
    const paymentTablesDiv = document.getElementById('payment-tables');
    db.tables.find({ status: 'dolu' }, (err, tables) => {
        if (err) {
            console.error('Masa yükleme hatası:', err);
            return;
        }
        
        let html = '';
        tables.forEach(table => {
            html += `
                <div class="payment-summary">
                    <h4>Masa ${table.number}</h4>
                    <div id="table-orders-${table._id}"></div>
                    <button class="btn btn-primary" onclick="processPayment('${table._id}')">
                        Ödeme Al
                    </button>
                </div>
            `;
        });
        paymentTablesDiv.innerHTML = html;
        
        // Her masa için siparişleri yükle
        tables.forEach(table => {
            loadTableOrders(table._id);
        });
    });
}

// Yeni Ürün ve Masa Ekle sayfası
function loadAddItemPage() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Yeni Ürün Ekle</h3>
                    <form id="add-product-form">
                        <div class="mb-3">
                            <label class="form-label">Ürün Adı</label>
                            <input type="text" class="form-control" name="name" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Kategori</label>
                            <select class="form-select" name="category" required>
                                <option value="">Kategori Seçin</option>
                                <option value="sicak-icecek">Sıcak İçecekler</option>
                                <option value="soguk-icecek">Soğuk İçecekler</option>
                                <option value="yiyecek">Yiyecekler</option>
                                <option value="tatli">Tatlılar</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Fiyat (TL)</label>
                            <input type="number" class="form-control" name="price" step="0.01" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Stok Miktarı</label>
                            <input type="number" class="form-control" name="stock" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Ürün Resmi</label>
                            <input type="file" class="form-control" name="image" accept="image/*" id="product-image">
                            <div class="mt-2">
                                <img id="image-preview" src="assets/default-product.png" 
                                     style="max-width: 200px; max-height: 200px; display: none;" 
                                     class="img-thumbnail">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary">Ürün Ekle</button>
                    </form>
                </div>
                <div class="table-container mt-4">
                    <h3>Ürünleri Sil</h3>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Ürün Resmi</th>
                                    <th>Ürün Adı</th>
                                    <th>Kategori</th>
                                    <th>Fiyat</th>
                                    <th>Stok</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody id="products-list"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Yeni Masa Ekle</h3>
                    <form id="add-table-form">
                        <div class="mb-3">
                            <label class="form-label">Masa Numarası</label>
                            <input type="number" class="form-control" name="number" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Masa Ekle</button>
                    </form>
                </div>
                <div class="table-container mt-4">
                    <h3>Masaları Sil</h3>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Masa No</th>
                                    <th>Durum</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody id="tables-list"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Resim önizleme
    document.getElementById('product-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('image-preview');
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    });

    // Form submit event listeners
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const imageFile = formData.get('image');
        
        // Resmi base64'e çevir
        if (imageFile.size > 0) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const product = {
                    name: formData.get('name'),
                    category: formData.get('category'),
                    price: parseFloat(formData.get('price')),
                    stock: parseInt(formData.get('stock')),
                    image: e.target.result,
                    createdAt: new Date()
                };

                saveProduct(product, e.target);
            };
            reader.readAsDataURL(imageFile);
        } else {
            const product = {
                name: formData.get('name'),
                category: formData.get('category'),
                price: parseFloat(formData.get('price')),
                stock: parseInt(formData.get('stock')),
                image: 'assets/default-product.png',
                createdAt: new Date()
            };

            saveProduct(product, e.target);
        }
    });

    document.getElementById('add-table-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const table = {
            number: parseInt(formData.get('number')),
            status: 'boş',
            createdAt: new Date()
        };

        db.tables.insert(table, (err, newTable) => {
            if (err) {
                showMessage('Masa eklenirken hata oluştu', 'error');
                return;
            }
            showMessage('Masa başarıyla eklendi');
            e.target.reset();
            loadTablesList();
        });
    });

    // Ürün ve masa listelerini yükle
    loadProductsList();
    loadTablesList();
}

// Ürün kaydetme fonksiyonu
function saveProduct(product, form) {
    db.products.insert(product, (err, newProduct) => {
        if (err) {
            showMessage('Ürün eklenirken hata oluştu', 'error');
            return;
        }
        showMessage('Ürün başarıyla eklendi');
        form.reset();
        document.getElementById('image-preview').style.display = 'none';
        loadProductsList();
    });
}

// Ürün listesini yükleme
function loadProductsList() {
    const productsBody = document.getElementById('products-list');
    db.products.find({}).sort({ name: 1 }).exec((err, products) => {
        if (err) {
            showMessage('Ürünler yüklenirken hata oluştu', 'error');
            return;
        }

        let html = '';
        products.forEach(product => {
            const categoryNames = {
                'sicak-icecek': 'Sıcak İçecekler',
                'soguk-icecek': 'Soğuk İçecekler',
                'yiyecek': 'Yiyecekler',
                'tatli': 'Tatlılar'
            };
            
            html += `
                <tr>
                    <td>
                        <img src="${product.image}" alt="${product.name}" 
                             style="max-width: 50px; max-height: 50px;" 
                             class="img-thumbnail">
                    </td>
                    <td>${product.name}</td>
                    <td>${categoryNames[product.category] || 'Kategorisiz'}</td>
                    <td>${formatPrice(product.price)}</td>
                    <td>${product.stock}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product._id}')">
                            Sil
                        </button>
                    </td>
                </tr>
            `;
        });
        productsBody.innerHTML = html;
    });
}

// Masa listesini yükleme
function loadTablesList() {
    const tablesBody = document.getElementById('tables-list');
    db.tables.find({}).sort({ number: 1 }).exec((err, tables) => {
        if (err) {
            showMessage('Masalar yüklenirken hata oluştu', 'error');
            return;
        }

        let html = '';
        tables.forEach(table => {
            html += `
                <tr>
                    <td>${table.number}</td>
                    <td>${table.status}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" 
                                onclick="deleteTable('${table._id}')"
                                ${table.status === 'dolu' ? 'disabled' : ''}>
                            Sil
                        </button>
                    </td>
                </tr>
            `;
        });
        tablesBody.innerHTML = html;
    });
}

// Ürün silme fonksiyonu
function deleteProduct(productId) {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
        return;
    }

    db.products.remove({ _id: productId }, {}, (err, numRemoved) => {
        if (err) {
            showMessage('Ürün silinirken hata oluştu', 'error');
            return;
        }
        showMessage('Ürün başarıyla silindi');
        loadProductsList();
    });
}

// Masa silme fonksiyonu
function deleteTable(tableId) {
    if (!confirm('Bu masayı silmek istediğinize emin misiniz?')) {
        return;
    }

    db.tables.remove({ _id: tableId }, {}, (err, numRemoved) => {
        if (err) {
            showMessage('Masa silinirken hata oluştu', 'error');
            return;
        }
        showMessage('Masa başarıyla silindi');
        loadTablesList();
    });
}

// Stok sayfası
function loadStockPage() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="table-container">
            <h3>Güncel Stok Durumu</h3>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Ürün Adı</th>
                            <th>Stok Miktarı</th>
                            <th>Fiyat</th>
                            <th>Durum</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody id="stock-table-body"></tbody>
                </table>
            </div>
        </div>
    `;

    // Stok tablosunu doldur
    updateStockTable();
}

// Stok tablosunu güncelleme
function updateStockTable() {
    const tableBody = document.getElementById('stock-table-body');
    db.products.find({}).sort({ name: 1 }).exec((err, products) => {
        if (err) {
            showMessage('Stok bilgileri yüklenirken hata oluştu', 'error');
            return;
        }

        let html = '';
        products.forEach(product => {
            const stockStatus = product.stock < 10 ? 'stock-warning' : 'success-message';
            html += `
                <tr>
                    <td>${product.name}</td>
                    <td>${product.stock}</td>
                    <td>${formatPrice(product.price)}</td>
                    <td class="${stockStatus}">
                        ${product.stock < 10 ? 'Stok Az!' : 'Yeterli'}
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" 
                                onclick="updateStock('${product._id}')">
                            Stok Güncelle
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    });
}

// Stok güncelleme işlemi
function updateStock(productId) {
    const newStock = prompt('Yeni stok miktarını giriniz:');
    if (newStock === null) return;

    const stock = parseInt(newStock);
    if (isNaN(stock) || stock < 0) {
        showMessage('Geçersiz stok miktarı', 'error');
        return;
    }

    db.products.update(
        { _id: productId },
        { $set: { stock: stock } },
        {},
        (err, numReplaced) => {
            if (err) {
                showMessage('Stok güncellenirken hata oluştu', 'error');
                return;
            }
            showMessage('Stok başarıyla güncellendi');
            updateStockTable();
        }
    );
}

// Özet sayfası
function loadSummaryPage() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="row mb-4">
            <div class="col-12">
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary active" onclick="changeSummaryPeriod('daily')">Günlük</button>
                    <button type="button" class="btn btn-outline-primary" onclick="changeSummaryPeriod('weekly')">Haftalık</button>
                    <button type="button" class="btn btn-outline-primary" onclick="changeSummaryPeriod('monthly')">Aylık</button>
                    <button type="button" class="btn btn-outline-primary" onclick="changeSummaryPeriod('yearly')">Yıllık</button>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Özet</h3>
                    <div id="period-summary"></div>
                </div>
                <div class="table-container mt-4">
                    <h3>En Çok Satan Ürünler</h3>
                    <div id="top-products"></div>
                </div>
                <div class="table-container mt-4">
                    <h3>Son Siparişler</h3>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Masa</th>
                                    <th>Ürünler</th>
                                    <th>Toplam</th>
                                    <th>Tarih</th>
                                    <th>Durum/Kasiyer</th>
                                </tr>
                            </thead>
                            <tbody id="recent-orders"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Satış Grafiği</h3>
                    <canvas id="sales-chart"></canvas>
                </div>
            </div>
        </div>
    `;

    // Varsayılan olarak günlük özeti yükle
    changeSummaryPeriod('daily');
    // Son siparişleri yükle
    loadRecentOrders();
}

// Özet periyodunu değiştirme
function changeSummaryPeriod(period) {
    // Buton stillerini güncelle
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.btn-group .btn:nth-child(${['daily', 'weekly', 'monthly', 'yearly'].indexOf(period) + 1})`).classList.add('active');

    // İlgili verileri yükle
    loadPeriodSummary(period);
    loadTopProducts(period);
    loadSalesChart(period);
}

// Periyoda göre özet yükleme
function loadPeriodSummary(period) {
    const startDate = getStartDate(period);
    
    db.orders.find({ 
        createdAt: { $gte: startDate },
        status: 'paid'
    }, (err, orders) => {
        if (err) {
            showMessage('Özet yüklenirken hata oluştu', 'error');
            return;
        }

        const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
        const orderCount = orders.length;
        const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

        // Kasiyer bazlı satışlar
        const cashierSales = {};
        orders.forEach(order => {
            if (order.cashier) {
                cashierSales[order.cashier] = (cashierSales[order.cashier] || 0) + order.total;
            }
        });

        const summaryDiv = document.getElementById('period-summary');
        summaryDiv.innerHTML = `
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">Toplam Satış</h5>
                    <p class="card-text">${formatPrice(totalSales)}</p>
                </div>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">Toplam Sipariş</h5>
                    <p class="card-text">${orderCount} adet</p>
                </div>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">Ortalama Sipariş Tutarı</h5>
                    <p class="card-text">${formatPrice(avgOrderValue)}</p>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">Kasiyer Bazlı Satışlar</h5>
                    <ul class="list-group list-group-flush">
                        ${Object.entries(cashierSales).map(([cashier, total]) => `
                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                ${cashier}
                                <span>${formatPrice(total)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    });
}

// Periyoda göre en çok satan ürünleri yükleme
function loadTopProducts(period) {
    const startDate = getStartDate(period);

    db.orders.find({ 
        createdAt: { $gte: startDate },
        status: 'paid'
    }, (err, orders) => {
        if (err) {
            showMessage('En çok satan ürünler yüklenirken hata oluştu', 'error');
            return;
        }

        const productSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
            });
        });

        const sortedProducts = Object.entries(productSales)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        const topProductsDiv = document.getElementById('top-products');
        let html = '<ul class="list-group">';
        sortedProducts.forEach(([name, count]) => {
            html += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    ${name}
                    <span class="badge bg-primary rounded-pill">${count} adet</span>
                </li>
            `;
        });
        html += '</ul>';
        topProductsDiv.innerHTML = html;
    });
}

// Satış grafiğini yükleme
function loadSalesChart(period) {
    const startDate = getStartDate(period);
    const intervals = getChartIntervals(period);

    db.orders.find({ 
        createdAt: { $gte: startDate },
        status: 'paid'
    }, (err, orders) => {
        if (err) {
            showMessage('Grafik verileri yüklenirken hata oluştu', 'error');
            return;
        }

        // Satışları aralıklara göre grupla
        const salesData = {};
        intervals.forEach(interval => {
            salesData[interval.label] = 0;
        });

        orders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const label = getIntervalLabel(orderDate, period);
            if (label in salesData) {
                salesData[label] += order.total;
            }
        });

        // Grafik verilerini hazırla
        const labels = Object.keys(salesData);
        const data = Object.values(salesData);

        // Eski grafiği temizle
        const chartCanvas = document.getElementById('sales-chart');
        if (window.salesChart) {
            window.salesChart.destroy();
        }

        // Yeni grafiği oluştur
        window.salesChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Satışlar',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatPrice(value)
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: context => formatPrice(context.raw)
                        }
                    }
                }
            }
        });
    });
}

// Başlangıç tarihini hesaplama
function getStartDate(period) {
    const now = new Date();
    switch (period) {
        case 'daily':
            return new Date(now.setHours(0, 0, 0, 0));
        case 'weekly':
            return new Date(now.setDate(now.getDate() - 7));
        case 'monthly':
            return new Date(now.setMonth(now.getMonth() - 1));
        case 'yearly':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        default:
            return new Date(now.setHours(0, 0, 0, 0));
    }
}

// Grafik aralıklarını hesaplama
function getChartIntervals(period) {
    const intervals = [];
    const now = new Date();
    let current;

    switch (period) {
        case 'daily':
            // Son 24 saat, saatlik aralıklarla
            for (let i = 23; i >= 0; i--) {
                current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i);
                intervals.push({
                    date: current,
                    label: `${i}:00`
                });
            }
            break;

        case 'weekly':
            // Son 7 gün
            for (let i = 6; i >= 0; i--) {
                current = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                intervals.push({
                    date: current,
                    label: current.toLocaleDateString('tr-TR', { weekday: 'short' })
                });
            }
            break;

        case 'monthly':
            // Son 30 gün, 5'er günlük aralıklarla
            for (let i = 29; i >= 0; i -= 5) {
                current = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                intervals.push({
                    date: current,
                    label: current.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                });
            }
            break;

        case 'yearly':
            // Son 12 ay
            for (let i = 11; i >= 0; i--) {
                current = new Date(now.getFullYear(), now.getMonth() - i);
                intervals.push({
                    date: current,
                    label: current.toLocaleDateString('tr-TR', { month: 'short' })
                });
            }
            break;
    }

    return intervals;
}

// Tarih için aralık etiketi oluşturma
function getIntervalLabel(date, period) {
    switch (period) {
        case 'daily':
            return `${date.getHours()}:00`;
        case 'weekly':
            return date.toLocaleDateString('tr-TR', { weekday: 'short' });
        case 'monthly':
            return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        case 'yearly':
            return date.toLocaleDateString('tr-TR', { month: 'short' });
        default:
            return date.toLocaleDateString();
    }
}

// Ayarlar sayfası
function loadSettingsPage() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Sistem Ayarları</h3>
                    <form id="settings-form">
                        <div class="mb-3">
                            <label class="form-label">İşletme Adı</label>
                            <input type="text" class="form-control" name="businessName" id="businessName">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Vergi Numarası</label>
                            <input type="text" class="form-control" name="taxNumber" id="taxNumber">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Adres</label>
                            <textarea class="form-control" name="address" id="address"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">KDV Oranı (%)</label>
                            <input type="number" class="form-control" name="taxRate" id="taxRate">
                        </div>
                        <button type="submit" class="btn btn-primary">Ayarları Kaydet</button>
                    </form>
                </div>
            </div>
            <div class="col-md-6">
                <div class="table-container">
                    <h3>Veritabanı İşlemleri</h3>
                    <div class="d-grid gap-3">
                        <button class="btn btn-warning" onclick="backupDatabase()">
                            Yedekleme Oluştur
                        </button>
                        <button class="btn btn-danger" onclick="clearDatabase()">
                            Veritabanını Temizle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Mevcut ayarları yükle
    loadCurrentSettings();

    // Form submit event listener
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const settings = {
            businessName: formData.get('businessName'),
            taxNumber: formData.get('taxNumber'),
            address: formData.get('address'),
            taxRate: parseFloat(formData.get('taxRate')),
            updatedAt: new Date()
        };

        db.settings.update(
            {},
            settings,
            { upsert: true },
            (err) => {
                if (err) {
                    showMessage('Ayarlar kaydedilirken hata oluştu', 'error');
                    return;
                }
                showMessage('Ayarlar başarıyla kaydedildi');
            }
        );
    });
}

// Mevcut ayarları yükleme
function loadCurrentSettings() {
    db.settings.findOne({}, (err, settings) => {
        if (err) {
            showMessage('Ayarlar yüklenirken hata oluştu', 'error');
            return;
        }

        if (settings) {
            document.getElementById('businessName').value = settings.businessName || '';
            document.getElementById('taxNumber').value = settings.taxNumber || '';
            document.getElementById('address').value = settings.address || '';
            document.getElementById('taxRate').value = settings.taxRate || 18;
        }
    });
}

// Veritabanı yedekleme
function backupDatabase() {
    const date = new Date().toISOString().slice(0, 10);
    const backupData = {};

    // Tüm veritabanlarını yedekle
    Promise.all([
        new Promise((resolve) => db.products.find({}, (err, docs) => resolve(err ? [] : docs))),
        new Promise((resolve) => db.orders.find({}, (err, docs) => resolve(err ? [] : docs))),
        new Promise((resolve) => db.tables.find({}, (err, docs) => resolve(err ? [] : docs))),
        new Promise((resolve) => db.settings.find({}, (err, docs) => resolve(err ? [] : docs)))
    ]).then(([products, orders, tables, settings]) => {
        backupData.products = products;
        backupData.orders = orders;
        backupData.tables = tables;
        backupData.settings = settings;

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${date}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showMessage('Yedekleme başarıyla oluşturuldu');
    });
}

// Veritabanını temizleme
function clearDatabase() {
    if (!confirm('Tüm veritabanı silinecek. Emin misiniz?')) {
        return;
    }

    Promise.all([
        new Promise((resolve) => db.products.remove({}, { multi: true }, resolve)),
        new Promise((resolve) => db.orders.remove({}, { multi: true }, resolve)),
        new Promise((resolve) => db.tables.remove({}, { multi: true }, resolve))
    ]).then(() => {
        showMessage('Veritabanı başarıyla temizlendi');
        // Ana sayfaya yönlendir
        loadPage('order');
    });
}

// Son siparişleri yükleme
function loadRecentOrders() {
    db.orders.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .exec((err, orders) => {
            if (err) {
                showMessage('Son siparişler yüklenirken hata oluştu', 'error');
                return;
            }

            const recentOrdersBody = document.getElementById('recent-orders');
            let html = '';
            orders.forEach(order => {
                const items = order.items.map(item => `${item.name} (${item.quantity})`).join(', ');
                html += `
                    <tr>
                        <td>Masa ${order.tableNumber}</td>
                        <td>${items}</td>
                        <td>${formatPrice(order.total)}</td>
                        <td>${new Date(order.createdAt).toLocaleString()}</td>
                        <td>${order.status === 'paid' ? `<span class="text-success">Ödendi (${order.cashier || 'Bilinmiyor'})</span>` : '<span class="text-warning">Aktif</span>'}</td>
                    </tr>
                `;
            });
            recentOrdersBody.innerHTML = html;
        });
}

// Masa durumunu yükleme
function loadTableStatus(tableId) {
    const tableStatusDiv = document.getElementById('table-status');
    
    if (!tableId) {
        tableStatusDiv.innerHTML = '<p>Lütfen bir masa seçin</p>';
        return;
    }

    db.orders.find({ tableId: tableId, status: 'active' }).exec((err, orders) => {
        if (err) {
            showMessage('Masa durumu yüklenirken hata oluştu', 'error');
            return;
        }

        if (orders.length === 0) {
            tableStatusDiv.innerHTML = '<p>Bu masada aktif sipariş bulunmuyor</p>';
            return;
        }

        let html = '';
        orders.forEach(order => {
            html += `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">Masa ${order.tableNumber}</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>Adet</th>
                                        <th>Fiyat</th>
                                        <th>Toplam</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>${item.quantity}</td>
                                            <td>${formatPrice(item.price)}</td>
                                            <td>${formatPrice(item.price * item.quantity)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <h6>Sipariş Zamanı: ${new Date(order.createdAt).toLocaleString()}</h6>
                            <h5>Toplam: ${formatPrice(order.total)}</h5>
                        </div>
                    </div>
                </div>
            `;
        });

        tableStatusDiv.innerHTML = html;
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Navbar link tıklamaları
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.dataset.page;
            loadPage(page);
        });
    });

    // Masa tıklamaları
    document.addEventListener('click', (e) => {
        const tableCard = e.target.closest('.table-card');
        if (tableCard) {
            const tableId = tableCard.dataset.tableId;
            selectTable(tableId);
        }
    });

    // Menü öğesi tıklamaları
    document.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item-card');
        if (menuItem) {
            const productId = menuItem.dataset.productId;
            addToOrder(productId);
        }
    });
    
    // Varsayılan olarak sipariş sayfasını yükle
    loadPage('order');
});

// Toast mesaj sistemi
function showMessage(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show`;
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.getElementById('toast-container').appendChild(toast);

    // 3 saniye sonra toast'ı kaldır
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Fiyat formatı
function formatPrice(price) {
    return price.toFixed(2) + ' TL';
} 