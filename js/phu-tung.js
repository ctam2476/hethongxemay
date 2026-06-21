/**
 * js/phu-tung.js
 * Logic cho trang Quản lý Phụ Tùng – Card Grid Layout
 */

/* =====================================================
   STATE
   ===================================================== */
let danhSachPT = [];
let danhSachHienThiPT = [];
const itemPerPagePT = 6;          // 6 phù hợp để demo phân trang rõ ràng
let currentPagePT  = 1;
let activeCatPT    = 'all';       // slug danh mục đang chọn
const LOW_STOCK    = 30;          // ngưỡng cảnh báo tồn kho

/* Màu badge theo danh mục */
const CAT_COLORS = {
  'Lốp xe':          { bg: '#E6F1FB', color: '#185FA5' },
  'Dầu nhớt':        { bg: '#EAF3DE', color: '#3B6D11' },
  'Bình ắc quy':     { bg: '#FAEEDA', color: '#854F0B' },
  'Đèn xe':          { bg: '#FBEAF0', color: '#993556' },
  'Gương chiếu hậu': { bg: '#F1EFE8', color: '#5F5E5A' },
  'Phanh':           { bg: '#FAECE7', color: '#993C1D' },
  'Nhông sên dĩa':   { bg: '#EEEDFE', color: '#534AB7' },
};

let modalPhuTung;
let toastNotif;

/* =====================================================
   KHỞI TẠO
   ===================================================== */
document.addEventListener('DOMContentLoaded', function () {
  modalPhuTung = new bootstrap.Modal(document.getElementById('modalPhuTung'));
  toastNotif   = new bootstrap.Toast(document.getElementById('liveToast'));

  updateCartBadge();

  danhSachPT = getPhuTung();
  renderStatsPT();
  renderCatPillsPT();
  applyFiltersPT();

  /* Lọc */
  document.getElementById('searchPT').addEventListener('input', applyFiltersPT);
  document.getElementById('filterGiaPT').addEventListener('change', applyFiltersPT);
  document.getElementById('sortGiaPT').addEventListener('change', applyFiltersPT);

  /* Form */
  document.getElementById('btnThemPT').addEventListener('click', resetFormPT);
  document.getElementById('btnSavePT').addEventListener('click', savePhuTungData);

  document.getElementById('inpHinhAnhPT').addEventListener('input', function () {
    document.getElementById('previewImgPT').src =
      this.value || 'https://via.placeholder.com/200x200?text=Preview';
  });
});

/* =====================================================
   CART BADGE
   ===================================================== */
function updateCartBadge() {
  const cart  = getCart();
  const badge = document.getElementById('cartCount');
  if (badge) {
    badge.innerText = cart.reduce((sum, item) => sum + item.soLuong, 0);
  }
}

/* =====================================================
   STATS ROW – 4 chỉ số tổng quan
   ===================================================== */
function renderStatsPT() {
  const all       = danhSachPT;
  const lowCount  = all.filter(x => x.tonKho < LOW_STOCK).length;
  const totalUnits = all.reduce((s, x) => s + x.tonKho, 0);
  const totalValue = all.reduce((s, x) => s + x.tonKho * x.giaBan, 0);

  document.getElementById('ptStatsRow').innerHTML = `
    <div class="pt-stat-card">
      <div class="pt-stat-label">Tổng mặt hàng</div>
      <div class="pt-stat-value">${all.length} loại</div>
    </div>
    <div class="pt-stat-card ${lowCount > 0 ? 'danger' : ''}">
      <div class="pt-stat-label">Sắp hết hàng</div>
      <div class="pt-stat-value ${lowCount > 0 ? 'danger' : ''}">${lowCount} loại</div>
    </div>
    <div class="pt-stat-card">
      <div class="pt-stat-label">Tổng tồn kho</div>
      <div class="pt-stat-value">${totalUnits.toLocaleString('vi-VN')} cái</div>
    </div>
    <div class="pt-stat-card success">
      <div class="pt-stat-label">Giá trị tồn kho</div>
      <div class="pt-stat-value success">${formatShortValue(totalValue)}</div>
    </div>
  `;
}

function formatShortValue(val) {
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + ' tỷ';
  if (val >= 1_000_000)     return (val / 1_000_000).toFixed(1) + ' tr';
  return formatCurrency(val);
}

/* =====================================================
   CATEGORY PILLS
   ===================================================== */
function renderCatPillsPT() {
  /* Lấy danh mục unique từ dữ liệu thực */
  const cats = ['Tất cả', ...new Set(danhSachPT.map(x => x.loai))];

  document.getElementById('ptCatPills').innerHTML = cats.map(cat => {
    const val     = cat === 'Tất cả' ? 'all' : cat;
    const count   = val === 'all'
      ? danhSachPT.length
      : danhSachPT.filter(x => x.loai === cat).length;
    const color   = CAT_COLORS[cat];
    const isActive = activeCatPT === val;

    const dot = color
      ? `<span class="pt-cat-dot" style="background:${color.color}"></span>`
      : '';

    return `<button class="pt-cat-pill ${isActive ? 'active' : ''}"
                    data-cat="${val}"
                    onclick="setCatPT('${val}')">
              ${dot}${cat} <span class="pt-cat-count">${count}</span>
            </button>`;
  }).join('');
}

/* Gọi khi click pill */
function setCatPT(val) {
  activeCatPT = val;
  document.querySelectorAll('.pt-cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === val);
  });
  applyFiltersPT();
}

/* =====================================================
   BỘ LỌC & SẮP XẾP
   ===================================================== */
function applyFiltersPT() {
  const keyword = document.getElementById('searchPT').value.toLowerCase().trim();
  const mucGia  = document.getElementById('filterGiaPT').value;
  const sort    = document.getElementById('sortGiaPT').value;

  let results = [...danhSachPT];

  /* Lọc danh mục (pills) */
  if (activeCatPT !== 'all') {
    results = results.filter(pt => pt.loai === activeCatPT);
  }

  /* Tìm kiếm */
  if (keyword) {
    results = results.filter(pt =>
      pt.ten.toLowerCase().includes(keyword) ||
      pt.id.toLowerCase().includes(keyword)
    );
  }

  /* Lọc giá */
  if (mucGia !== 'all') {
    results = results.filter(pt => {
      const g = pt.giaBan;
      if (mucGia === 'duoi100')  return g < 100000;
      if (mucGia === '100-300')  return g >= 100000 && g <= 300000;
      if (mucGia === '300-500')  return g > 300000  && g <= 500000;
      if (mucGia === 'tren500')  return g > 500000;
      return true;
    });
  }

  /* Sắp xếp */
  if (sort === 'asc')       results.sort((a, b) => a.giaBan  - b.giaBan);
  else if (sort === 'desc') results.sort((a, b) => b.giaBan  - a.giaBan);
  else if (sort === 'stock-asc') results.sort((a, b) => a.tonKho - b.tonKho);

  danhSachHienThiPT = results;
  currentPagePT = 1;
  renderTablePT();
}

/* =====================================================
   RENDER CHÍNH – điều phối grid / list
   ===================================================== */
function renderTablePT() {
  const totalItems = danhSachHienThiPT.length;
  const totalPages = Math.ceil(totalItems / itemPerPagePT);
  const start      = (currentPagePT - 1) * itemPerPagePT;
  const end        = Math.min(start + itemPerPagePT, totalItems);
  const items      = danhSachHienThiPT.slice(start, end);

  updatePaginationInfoPT(totalItems > 0 ? start + 1 : 0, end, totalItems);
  renderPaginationPT(totalPages);
  renderGridPT(items, totalItems);
}

/* =====================================================
   RENDER GRID (mặc định)
   ===================================================== */
function getStockBar(tonKho) {
  const pct   = Math.min((tonKho / 200) * 100, 100);
  const color = tonKho < LOW_STOCK ? '#dc3545'
              : tonKho < 80        ? '#fd7e14'
              :                      '#28a745';
  return { pct, color };
}

function renderGridPT(items, total) {
  const container = document.getElementById('ptGridContainer');

  if (total === 0) {
    container.innerHTML = `
      <div class="pt-empty-state">
        <i class="fa-solid fa-box-open"></i>
        <p>Không tìm thấy phụ tùng phù hợp.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(pt => {
    const cat     = CAT_COLORS[pt.loai] || { bg: '#f8f9fa', color: '#6c757d' };
    const { pct, color: barColor } = getStockBar(pt.tonKho);
    const isLow   = pt.tonKho < LOW_STOCK;

    return `
      <div class="pt-card">
        <!-- Vùng ảnh -->
        <div class="pt-card-img-wrap">
          <img src="${pt.hinhAnh}" alt="${pt.ten}"
               onerror="this.src='https://placehold.co/100x100?text=No+Img'">
          <span class="pt-card-cat-badge"
                style="background:${cat.bg};color:${cat.color}">${pt.loai}</span>
          <div class="pt-card-actions">
            <button class="pt-card-action-btn edit" title="Sửa"
                    onclick="editPT('${pt.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="pt-card-action-btn delete" title="Xóa"
                    onclick="deletePT('${pt.id}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <!-- Thông tin -->
        <div class="pt-card-body">
          <div class="pt-card-code">${pt.id}</div>
          <div class="pt-card-name" title="${pt.ten}">${pt.ten}</div>
          <div class="pt-card-supplier">
            <i class="fa-solid fa-building" style="font-size:12px;margin-right:5px"></i>${pt.nhaCungCap}
          </div>

          <!-- Giá + thanh tồn kho -->
          <div class="pt-card-bottom">
            <div class="pt-card-price">${formatCurrency(pt.giaBan)}</div>
            <div class="pt-stock-wrap" title="Còn lại ${pt.tonKho} cái trong kho">
              <div class="pt-stock-bar-bg">
                <div class="pt-stock-bar"
                     style="width:${pct.toFixed(0)}%;background:${barColor}"></div>
              </div>
              <div class="pt-stock-label ${isLow ? 'low' : ''}">
                ${pt.tonKho} cái${isLow ? ' ⚠' : ''}
              </div>
            </div>
          </div>

          <!-- Nút thêm vào đơn -->
          <button class="pt-card-cart-btn" onclick="addToCartPT('${pt.id}')">
            <i class="fa-solid fa-cart-plus"></i> Thêm vào đơn
          </button>
        </div>
      </div>`;
  }).join('');
}

/* =====================================================
   PHÂN TRANG
   ===================================================== */
function updatePaginationInfoPT(start, end, total) {
  document.getElementById('infoPagination').innerText =
    total === 0
      ? 'Không có dữ liệu'
      : `Hiển thị ${start} – ${end} trong tổng số ${total} mặt hàng`;
}

function renderPaginationPT(totalPages) {
  const container = document.getElementById('paginationContainer');
  container.innerHTML = '';
  if (totalPages <= 1) return;

  container.innerHTML += `
    <li class="page-item ${currentPagePT === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#"
         onclick="changePagePT(${currentPagePT - 1}); return false;">&laquo;</a>
    </li>`;

  for (let i = 1; i <= totalPages; i++) {
    container.innerHTML += `
      <li class="page-item ${currentPagePT === i ? 'active' : ''}">
        <a class="page-link" href="#"
           onclick="changePagePT(${i}); return false;">${i}</a>
      </li>`;
  }

  container.innerHTML += `
    <li class="page-item ${currentPagePT === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#"
         onclick="changePagePT(${currentPagePT + 1}); return false;">&raquo;</a>
    </li>`;
}

function changePagePT(page) {
  const totalPages = Math.ceil(danhSachHienThiPT.length / itemPerPagePT);
  if (page >= 1 && page <= totalPages) {
    currentPagePT = page;
    renderTablePT();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* =====================================================
   FORM – THÊM / SỬA / XÓA
   ===================================================== */
function resetFormPT() {
  document.getElementById('formPhuTung').reset();
  document.getElementById('formActionPT').value  = 'add';
  document.getElementById('modalPTLabel').innerText = 'Thêm Phụ Tùng Mới';
  document.getElementById('inpMaPT').value       = generateId('PT');
  document.getElementById('inpMaPT').readOnly    = true;
  document.getElementById('previewImgPT').src    =
    'https://via.placeholder.com/200x200?text=Preview';
}

function editPT(id) {
  const pt = danhSachPT.find(x => x.id === id);
  if (!pt) return;

  document.getElementById('formActionPT').value    = 'edit';
  document.getElementById('modalPTLabel').innerText = 'Chỉnh Sửa Phụ Tùng';
  document.getElementById('inpMaPT').value         = pt.id;
  document.getElementById('inpMaPT').readOnly      = true;
  document.getElementById('inpTenPT').value        = pt.ten;
  document.getElementById('inpLoaiPT').value       = pt.loai;
  document.getElementById('inpNhaCungCap').value   = pt.nhaCungCap;
  document.getElementById('inpGiaNhapPT').value    = pt.giaNhap;
  document.getElementById('inpGiaBanPT').value     = pt.giaBan;
  document.getElementById('inpTonKhoPT').value     = pt.tonKho;
  document.getElementById('inpHinhAnhPT').value    = pt.hinhAnh;
  document.getElementById('previewImgPT').src      =
    pt.hinhAnh || 'https://via.placeholder.com/200x200?text=Preview';
  document.getElementById('inpMoTaPT').value       = pt.moTa || '';

  modalPhuTung.show();
}

function deletePT(id) {
  if (!confirm(`Bạn có chắc muốn xóa phụ tùng ${id}?`)) return;
  danhSachPT = danhSachPT.filter(x => x.id !== id);
  savePhuTung(danhSachPT);
  renderStatsPT();
  renderCatPillsPT();
  applyFiltersPT();
  showToast('Xóa thành công', `Đã xóa phụ tùng ${id}`, 'success');
}

function savePhuTungData() {
  const form = document.getElementById('formPhuTung');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const action = document.getElementById('formActionPT').value;
  const id     = document.getElementById('inpMaPT').value;

  const ptData = {
    id,
    ten:         document.getElementById('inpTenPT').value,
    loai:        document.getElementById('inpLoaiPT').value,
    nhaCungCap:  document.getElementById('inpNhaCungCap').value,
    giaNhap:     parseInt(document.getElementById('inpGiaNhapPT').value),
    giaBan:      parseInt(document.getElementById('inpGiaBanPT').value),
    tonKho:      parseInt(document.getElementById('inpTonKhoPT').value),
    hinhAnh:     document.getElementById('inpHinhAnhPT').value,
    moTa:        document.getElementById('inpMoTaPT').value,
  };

  if (action === 'add') {
    danhSachPT.unshift(ptData);
    showToast('Thêm thành công', `Đã thêm: ${ptData.ten}`, 'success');
  } else {
    const idx = danhSachPT.findIndex(x => x.id === id);
    if (idx !== -1) { danhSachPT[idx] = ptData; }
    showToast('Cập nhật thành công', `Đã cập nhật: ${id}`, 'success');
  }

  savePhuTung(danhSachPT);
  modalPhuTung.hide();

  /* Refresh toàn bộ UI */
  renderStatsPT();
  renderCatPillsPT();
  applyFiltersPT();
}

/* =====================================================
   THÊM VÀO GIỎ HÀNG
   ===================================================== */
window.addToCartPT = function (id) {
  const pt = danhSachPT.find(x => x.id === id);
  if (!pt) return;

  if (pt.tonKho <= 0) {
    showToast('Thất bại', 'Sản phẩm đã hết hàng', 'error');
    return;
  }

  const cart      = getCart();
  const existIdx  = cart.findIndex(item => item.id === pt.id && item.type === 'phutung');

  if (existIdx !== -1) {
    if (cart[existIdx].soLuong >= pt.tonKho) {
      showToast('Thất bại', `Tồn kho chỉ còn ${pt.tonKho}`, 'error');
      return;
    }
    cart[existIdx].soLuong += 1;
  } else {
    cart.push({
      id:      pt.id,
      ten:     pt.ten,
      gia:     pt.giaBan,
      hinhAnh: pt.hinhAnh,
      soLuong: 1,
      type:    'phutung',
    });
  }

  saveCart(cart);
  updateCartBadge();
  showToast('Thành công', `Đã thêm "${pt.ten}" vào hóa đơn`, 'success');
};

/* =====================================================
   TOAST NOTIFICATION
   ===================================================== */
function showToast(title, message, type) {
  const header = document.getElementById('toastHeader');
  const icon   = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
  const bgCls  = type === 'success' ? 'bg-success' : 'bg-danger';

  header.className = `toast-header text-white ${bgCls}`;
  header.innerHTML = `
    <i class="fa-solid ${icon} me-2"></i>
    <strong class="me-auto">${title}</strong>
    <button type="button" class="btn-close btn-close-white"
            data-bs-dismiss="toast" aria-label="Close"></button>`;

  document.getElementById('toastMessage').innerText = message;
  toastNotif.show();
}
