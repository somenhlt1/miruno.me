// ============================================================
// CONFIGURATION & SETUP
// ============================================================

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_ANON_KEY;
let supabaseClient;
let useMockData = true;

// Anonymous user identity — generated once, stored permanently in localStorage
function getOrCreateUserId() {
    let id = localStorage.getItem('wishlist_user_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('wishlist_user_id', id);
    }
    return id;
}
const MY_USER_ID = getOrCreateUserId();

// Pagination & State
let allFetchedItems = [];
let filteredItems = [];
let currentPage = 1;
const itemsPerPage = 6;
let isFetchingMore = false;
let activeFilter = 'all';
let searchQuery = '';

// DOM Refs — all elements are static in HTML so these are always available
const grid           = document.getElementById('wishlist-grid');
const loading        = document.getElementById('loading');
const errorMessage   = document.getElementById('error-message');
const counterText    = document.getElementById('counter-text');
const searchInput    = document.getElementById('search-input');
const filterGroup    = document.getElementById('filter-group');
const backToTopBtn   = document.getElementById('back-to-top-btn');
const toastContainer = document.getElementById('toast-container');

// ============================================================
// MOCK DATA
// ============================================================

const mockItems = [
    { id: 1, title: "Bàn Phím Cơ",           description: "Một chiếc bàn phím cơ custom tuyệt đẹp với tactile switch.",     url: "https://example.com/keyboard",  image_url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=500&q=60", price: 150.00, is_selected: false, claimer_id: null,           category: "Công Nghệ"  },
    { id: 2, title: "Tai Nghe Chống Ồn",      description: "Tai nghe over-ear để tập trung làm việc sâu.",                  url: "https://example.com/headphones",image_url: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=500&q=60", price: 299.99, is_selected: true,  claimer_id: 'demo_other_user', category: "Công Nghệ"  },
    { id: 3, title: "Đăng Ký Cà Phê Hạt",    description: "Gói đăng ký 3 tháng từ một nhà rang xay địa phương.",          url: "https://example.com/coffee",    image_url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=500&q=60", price: 60.00,  is_selected: false, claimer_id: null,           category: "Đồ Uống"   },
    { id: 4, title: "Balo Chống Nước",        description: "Balo xịn xò đi mưa không sợ ướt laptop.",                      url: "https://example.com/backpack",  image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=60", price: 85.00,  is_selected: false, claimer_id: null,           category: "Thời Trang" },
    { id: 5, title: "Chuột Công Thái Học",    description: "Bảo vệ cổ tay khi làm việc cả ngày dài.",                      url: "https://example.com/mouse",     image_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=500&q=60", price: 120.00, is_selected: false, claimer_id: null,           category: "Công Nghệ"  },
    { id: 6, title: "Sổ Tay Bìa Da",          description: "Sổ tay cao cấp để ghi chép ý tưởng.",                         url: "https://example.com/notebook",  image_url: "https://images.unsplash.com/photo-1531346878377-a541fa15c324?auto=format&fit=crop&w=500&q=60", price: 25.00,  is_selected: true,  claimer_id: MY_USER_ID,        category: "Văn Phòng"  },
    { id: 7, title: "Bình Giữ Nhiệt",         description: "Giữ nước đá lạnh 24h hoặc cà phê nóng 12h.",                  url: "https://example.com/flask",     image_url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=500&q=60", price: 35.00,  is_selected: false, claimer_id: null,           category: "Đồ Uống"   },
    { id: 8, title: "Đèn Bàn Không Dây",      description: "Đèn LED bảo vệ mắt, có thể sạc lại.",                         url: "https://example.com/lamp",      image_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=60", price: 45.00,  is_selected: false, claimer_id: null,           category: "Nội Thất"  },
    { id: 9, title: "Loa Bluetooth Mini",     description: "Âm thanh rõ ràng, nhỏ gọn mang đi mọi nơi.",                  url: "https://example.com/speaker",   image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=500&q=60", price: 70.00,  is_selected: false, claimer_id: null,           category: "Công Nghệ"  },
];

// ============================================================
// INIT
// ============================================================

// Wire up search
searchInput.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFiltersAndSearch();
}, 250));

// Wire up filter buttons
filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFiltersAndSearch();
    });
});

// Wire up back-to-top
backToTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// Scroll listener: back-to-top visibility + infinite scroll (throttled)
window.addEventListener('scroll', throttle(() => {
    backToTopBtn.classList.toggle('visible', window.scrollY > 300);
    checkScrollForMore();
}, 100));

// Init Supabase or use mock data
if (supabaseUrl === 'YOUR_SUPABASE_URL_HERE' || supabaseKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    console.warn("Không tìm thấy cấu hình Supabase. Đang sử dụng dữ liệu mẫu.");
    useMockData = true;
} else {
    try {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        useMockData = false;
    } catch (err) {
        showError("Không thể khởi tạo kết nối Supabase.");
        console.error(err);
    }
}

// Kick off data fetch
fetchItems();

// ============================================================
// FETCH
// ============================================================

async function fetchItems() {
    loading.classList.remove('hidden');
    grid.classList.add('hidden');
    grid.innerHTML = '';

    try {
        if (useMockData) {
            allFetchedItems = [...mockItems];
        } else {
            const { data: items, error } = await supabaseClient
                .from('wishlist_items')
                .select('*')
                .order('id', { ascending: false });
            if (error) throw error;
            allFetchedItems = items;
        }
    } catch (err) {
        showError("Lỗi khi tải danh sách: " + err.message);
        console.error(err);
        loading.classList.add('hidden');
        return;
    }

    currentPage = 1;
    isFetchingMore = false;
    filteredItems = [...allFetchedItems];

    loading.classList.add('hidden');
    updateCounter();
    renderCurrentPage(false);
}

// ============================================================
// FILTER & SEARCH
// ============================================================

function applyFiltersAndSearch() {
    filteredItems = allFetchedItems.filter(item => {
        const matchSearch = !searchQuery
            || item.title.toLowerCase().includes(searchQuery)
            || (item.description && item.description.toLowerCase().includes(searchQuery));

        const matchFilter =
            activeFilter === 'all' ||
            (activeFilter === 'available' && !item.is_selected) ||
            (activeFilter === 'taken'     && item.is_selected);

        return matchSearch && matchFilter;
    });

    currentPage = 1;
    isFetchingMore = false;
    updateCounter();
    renderCurrentPage(false);
}

function updateCounter() {
    if (!counterText) return;
    const total     = filteredItems.length;
    const taken     = filteredItems.filter(i => i.is_selected).length;
    const available = total - taken;
    counterText.innerHTML = `
        <span class="count-chip total">🎁 ${total} món quà</span>
        <span class="count-chip available">✅ ${available} còn trống</span>
        <span class="count-chip taken">💝 ${taken} đã được chọn</span>
    `;
}

// ============================================================
// RENDER
// ============================================================

function getClaimState(item) {
    return {
        isMineClaimed:  item.is_selected && item.claimer_id === MY_USER_ID,
        isOtherClaimed: item.is_selected && item.claimer_id !== MY_USER_ID,
    };
}

function applyButtonState(btn, item) {
    const { isMineClaimed, isOtherClaimed } = getClaimState(item);
    if (isMineClaimed) {
        btn.className   = 'btn btn-mine';
        btn.disabled    = false;
        btn.textContent = '✏️ Huỷ chọn của tôi';
        btn.setAttribute('onclick', `claimItem(${item.id}, false)`);
    } else if (isOtherClaimed) {
        btn.className   = 'btn btn-selected';
        btn.disabled    = true;
        btn.textContent = '💝 Đã Có Người Mua';
        btn.removeAttribute('onclick');
    } else {
        btn.className   = 'btn btn-primary';
        btn.disabled    = false;
        btn.textContent = '🛍️ Tôi muốn mua món này!';
        btn.setAttribute('onclick', `claimItem(${item.id}, true)`);
    }
}

function renderCurrentPage(append) {
    const startIndex  = (currentPage - 1) * itemsPerPage;
    const itemsToShow = filteredItems.slice(startIndex, startIndex + itemsPerPage);

    if (!append) grid.innerHTML = '';

    if (filteredItems.length === 0) {
        grid.innerHTML = '<p class="empty-message">Không tìm thấy món quà nào phù hợp.</p>';
        grid.classList.remove('hidden');
        isFetchingMore = false;
        return;
    }

    itemsToShow.forEach((item, i) => {
        const { isMineClaimed } = getClaimState(item);
        const card = document.createElement('div');
        card.className = `card ${item.is_selected ? 'is-selected' : ''} ${isMineClaimed ? 'is-mine' : ''}`;
        card.dataset.id = item.id;
        card.style.animationDelay = `${i * 60}ms`;

        card.innerHTML = `
            <div class="selected-overlay">${isMineClaimed ? '🎁 Món của tôi' : 'Đã Chọn ✨'}</div>
            ${item.image_url
                ? `<img src="${item.image_url}" alt="${item.title}" class="card-image" loading="lazy">`
                : `<div class="card-image placeholder-img">🎁</div>`
            }
            <div class="card-body">
                ${item.category ? `<span class="card-category">${item.category}</span>` : ''}
                <h3 class="card-title">${item.title}</h3>
                ${item.description ? `<p class="card-description">${item.description}</p>` : ''}
                ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="item-link">Xem Sản Phẩm ↗️</a>` : ''}
                ${item.price ? `<div class="card-price">$${item.price.toFixed(2)}</div>` : ''}
                <button class="btn"></button>
            </div>
            <button class="admin-edit-btn" onclick="openItemForm(${item.id})">✏️ Edit</button>
        `;
        applyButtonState(card.querySelector('.card-body button'), item);
        grid.appendChild(card);
    });

    grid.classList.remove('hidden');
    isFetchingMore = false;
}

// ============================================================
// INFINITE SCROLL — window scroll based
// ============================================================

function checkScrollForMore() {
    if (isFetchingMore) return;
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (currentPage >= totalPages) return;

    const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;

    if (scrolledToBottom) {
        isFetchingMore = true;
        currentPage++;
        setTimeout(() => renderCurrentPage(true), 300);
    }
}

// ============================================================
// CLAIM / UNCLAIM ITEM
// ============================================================

function updateCardDOM(id) {
    const item = allFetchedItems.find(i => i.id === id);
    if (!item) return;

    const card = grid.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const { isMineClaimed } = getClaimState(item);
    card.classList.toggle('is-selected', item.is_selected);
    card.classList.toggle('is-mine', isMineClaimed);

    const overlay = card.querySelector('.selected-overlay');
    if (overlay) overlay.textContent = isMineClaimed ? '🎁 Món của tôi' : 'Đã Chọn ✨';

    applyButtonState(card.querySelector('.card-body button'), item);
    updateCounter();
}

async function claimItem(id, claim) {
    const toastMsg = claim
        ? '🎉 Tuyệt vời! Cảm ơn bạn rất nhiều! Món quà này sẽ khiến tôi thực sự hạnh phúc! 💖'
        : '👍 Đã huỷ chọn! Món quà này bây giờ lại có thể được chọn bởi người khác.';

    try {
        if (useMockData) {
            const item = allFetchedItems.find(i => i.id === id);
            if (!item) return;
            if (claim && item.is_selected) return;
            if (!claim && item.claimer_id !== MY_USER_ID) return;
            item.is_selected = claim;
            item.claimer_id  = claim ? MY_USER_ID : null;
            updateCardDOM(id);
            if (claim) launchConfetti();
            showToast(toastMsg);
            return;
        }

        const patch = claim
            ? { is_selected: true,  claimer_id: MY_USER_ID }
            : { is_selected: false, claimer_id: null };

        let query = supabaseClient.from('wishlist_items').update(patch).eq('id', id);
        if (claim)  query = query.is('is_selected', false);
        if (!claim) query = query.eq('claimer_id', MY_USER_ID);

        const { error } = await query;
        if (error) throw error;

        const item = allFetchedItems.find(i => i.id === id);
        if (item) { item.is_selected = patch.is_selected; item.claimer_id = patch.claimer_id; }
        updateCardDOM(id);
        if (claim) launchConfetti();
        showToast(toastMsg);

    } catch (err) {
        showError('Không thể cập nhật món quà: ' + err.message);
        console.error(err);
    }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message, duration = 4000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ============================================================
// CONFETTI
// ============================================================

function launchConfetti() {
    const colors = ['#58a6ff', '#d2a8ff', '#79c0ff', '#ffa657', '#ff7b72', '#3fb950'];
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${Math.random() * 8 + 6}px;
            height: ${Math.random() * 8 + 6}px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation-duration: ${Math.random() * 2 + 1.5}s;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => el.isConnected && el.remove(), 4000);
    }
}

// ============================================================
// UTILITIES
// ============================================================

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function throttle(fn, limit) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last >= limit) {
            last = now;
            fn(...args);
        }
    };
}

function showError(msg) {
    if (errorMessage) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
    }
    console.error(msg);
}

// ============================================================
// ADMIN
// ============================================================

let isAdminUnlocked = false;

// Trigger: ?admin in URL
if (new URLSearchParams(window.location.search).has('admin')) {
    window.addEventListener('DOMContentLoaded', openAdminPwModal);
}

function openAdminPwModal() {
    const modal = document.getElementById('admin-pw-modal');
    const input = document.getElementById('admin-pw-input');
    const err   = document.getElementById('admin-pw-error');
    err.classList.add('hidden');
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
}

function closeAdminPwModal() {
    document.getElementById('admin-pw-modal').classList.add('hidden');
}

function handleAdminOverlayClick(e) {
    if (e.target === document.getElementById('admin-pw-modal')) closeAdminPwModal();
}

function submitAdminPassword() {
    const input = document.getElementById('admin-pw-input');
    const err   = document.getElementById('admin-pw-error');
    if (input.value === config.ADMIN_PASSWORD) {
        isAdminUnlocked = true;
        document.body.classList.add('admin-unlocked');
        document.getElementById('admin-add-btn').classList.remove('hidden');
        closeAdminPwModal();
        showToast('🔓 Admin mode unlocked.');
    } else {
        err.classList.remove('hidden');
        input.value = '';
        input.focus();
    }
}

function lockAdmin() {
    isAdminUnlocked = false;
    document.body.classList.remove('admin-unlocked');
    document.getElementById('admin-add-btn').classList.add('hidden');
    showToast('🔒 Admin mode locked.');
}

// ── Image Upload ────────────────────────────────────────────

async function uploadImageToStorage(file) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `items/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseClient.storage
        .from(config.STORAGE_BUCKET)
        .upload(path, file, { upsert: false });
    if (error) throw error;

    const { data } = supabaseClient.storage
        .from(config.STORAGE_BUCKET)
        .getPublicUrl(path);
    return data.publicUrl;
}

function updateImagePreview(url) {
    const preview = document.getElementById('form-image-preview');
    if (!preview) return;
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
}

// Wire up image file picker
document.getElementById('form-image-file').addEventListener('change', async (e) => {
    const file   = e.target.files[0];
    const status = document.getElementById('image-upload-status');
    if (!file) return;

    if (useMockData) {
        status.textContent = '⚠️ Connect Supabase to upload images.';
        status.className = 'upload-status error';
        return;
    }

    status.textContent = '⏳ Uploading…';
    status.className = 'upload-status uploading';

    try {
        const publicUrl = await uploadImageToStorage(file);
        document.getElementById('form-image-url').value = publicUrl;
        updateImagePreview(publicUrl);
        status.textContent = '✅ Uploaded!';
        status.className = 'upload-status success';
    } catch (err) {
        status.textContent = '❌ Upload failed: ' + err.message;
        status.className = 'upload-status error';
        console.error(err);
    }
});

// Update preview when URL is typed manually
document.getElementById('form-image-url').addEventListener('input', (e) => {
    updateImagePreview(e.target.value.trim());
});

// ── Item Form ──────────────────────────────────────────────

function openItemForm(id) {
    if (!isAdminUnlocked) return;

    const modal   = document.getElementById('item-form-modal');
    const heading = document.getElementById('item-form-heading');
    const delBtn  = document.getElementById('delete-item-btn');

    document.getElementById('item-form').reset();
    document.getElementById('image-upload-status').textContent = '';
    document.getElementById('image-upload-status').className = 'upload-status';
    updateImagePreview('');

    if (id === null) {
        heading.textContent = '➕ Add Item';
        document.getElementById('form-id').value = '';
        delBtn.classList.add('hidden');
    } else {
        const item = allFetchedItems.find(i => i.id === id);
        if (!item) return;
        heading.textContent = '✏️ Edit Item';
        document.getElementById('form-id').value          = item.id;
        document.getElementById('form-title').value       = item.title        || '';
        document.getElementById('form-description').value = item.description  || '';
        document.getElementById('form-url').value         = item.url          || '';
        document.getElementById('form-image-url').value   = item.image_url    || '';
        document.getElementById('form-price').value       = item.price        != null ? item.price : '';
        document.getElementById('form-category').value    = item.category     || '';
        delBtn.classList.remove('hidden');
        updateImagePreview(item.image_url || '');
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('form-title').focus(), 50);
}

function closeItemForm() {
    document.getElementById('item-form-modal').classList.add('hidden');
}

function handleItemFormOverlayClick(e) {
    if (e.target === document.getElementById('item-form-modal')) closeItemForm();
}

async function submitItemForm(e) {
    e.preventDefault();

    const id    = document.getElementById('form-id').value;
    const patch = {
        title:       document.getElementById('form-title').value.trim(),
        description: document.getElementById('form-description').value.trim() || null,
        url:         document.getElementById('form-url').value.trim()         || null,
        image_url:   document.getElementById('form-image-url').value.trim()   || null,
        price:       parseFloat(document.getElementById('form-price').value)  || null,
        category:    document.getElementById('form-category').value.trim()    || null,
    };

    try {
        if (useMockData) {
            if (id) {
                const item = allFetchedItems.find(i => i.id === parseInt(id));
                if (item) Object.assign(item, patch);
            } else {
                const newId = Math.max(0, ...allFetchedItems.map(i => i.id)) + 1;
                allFetchedItems.unshift({ id: newId, is_selected: false, claimer_id: null, ...patch });
            }
            closeItemForm();
            currentPage = 1;
            applyFiltersAndSearch();
            showToast(id ? '✅ Item updated.' : '✅ Item added.');
            return;
        }

        if (id) {
            const { error } = await supabaseClient
                .from('wishlist_items')
                .update(patch)
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('wishlist_items')
                .insert({ ...patch, is_selected: false, claimer_id: null });
            if (error) throw error;
        }

        closeItemForm();
        await fetchItems();
        showToast(id ? '✅ Item updated.' : '✅ Item added.');

    } catch (err) {
        showError('Failed to save item: ' + err.message);
        console.error(err);
    }
}

async function deleteItem() {
    const id = document.getElementById('form-id').value;
    if (!id || !confirm('Delete this item? This cannot be undone.')) return;

    try {
        if (useMockData) {
            const idx = allFetchedItems.findIndex(i => i.id === parseInt(id));
            if (idx !== -1) allFetchedItems.splice(idx, 1);
            closeItemForm();
            currentPage = 1;
            applyFiltersAndSearch();
            showToast('🗑️ Item deleted.');
            return;
        }

        const { error } = await supabaseClient
            .from('wishlist_items')
            .delete()
            .eq('id', id);
        if (error) throw error;

        closeItemForm();
        await fetchItems();
        showToast('🗑️ Item deleted.');

    } catch (err) {
        showError('Failed to delete item: ' + err.message);
        console.error(err);
    }
}
