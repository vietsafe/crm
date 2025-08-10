/* ===== CRM APPLICATION v3.0 ===== */

// Configuration
const CONFIG = {
  SUPABASE_URL: 'https://sdmjdhmkjyadgyfodpsf.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbWpkaG1ranlhZGd5Zm9kcHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODQyNjIsImV4cCI6MjA2OTI2MDI2Mn0.Org3PD8CNmqCxC8ylbNiPA5Guo0w0srXgxyF2s2ZHG0',
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000
};

// Supabase Client
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Application State
const state = {
  currentUser: { email: null, role: 'user', userId: null },
  customers: [],
  projects: [],
  opportunities: [],
  quotes: [],
  contracts: [],
  payments: [],
  users: [],
  cache: {
    customerMap: new Map(),
    projectMap: new Map(),
    contractMap: new Map()
  }
};

// Utility Functions
const utils = {
  pad: (n, w) => String(n).padStart(w, '0'),
  
  getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },
  
  money: (n) => (n || 0).toLocaleString('vi-VN'),
  
  formatMoney(value) {
    const cleanValue = value.replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  
  parseMoney(value) {
    return parseInt(value.replace(/,/g, '') || '0', 10);
  },
  
  formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  },
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  showToast(message, type = 'success') {
    const toastContainer = document.querySelector('.toast-container');
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : 'success'} border-0`;
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;
    toastContainer.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    setTimeout(() => toastEl.remove(), CONFIG.TOAST_DURATION);
  },
  
  showLoading(element) {
    const originalContent = element.innerHTML;
    element.innerHTML = '<div class="loading mx-auto"></div>';
    element.disabled = true;
    return () => {
      element.innerHTML = originalContent;
      element.disabled = false;
    };
  }
};

// ID Generators
const generators = {
  customerId() {
    const used = state.customers.map(c => parseInt(c.id?.slice(1), 10)).filter(Number.isFinite);
    for (let i = 1; i < 10000; i++) {
      if (!used.includes(i)) return 'C' + utils.pad(i, 4);
    }
    throw new Error('Hết mã khách hàng');
  },
  
  projectId() {
    const y = new Date().getFullYear().toString().slice(-2);
    const used = state.projects
      .filter(p => p.project_id?.startsWith('P_' + y))
      .map(p => parseInt(p.project_id.slice(4), 10))
      .filter(Number.isFinite);
    for (let i = 1; i < 1000; i++) {
      if (!used.includes(i)) return 'P_' + y + utils.pad(i, 3);
    }
    throw new Error('Hết mã dự án');
  },
  
  opportunityId() {
    const used = state.opportunities
      .map(o => parseInt(o.opportunity_id?.split('_')[1], 10))
      .filter(Number.isFinite);
    for (let i = 1; i < 100000; i++) {
      if (!used.includes(i)) return 'Op_' + utils.pad(i, 5);
    }
    throw new Error('Hết mã cơ hội');
  },
  
  quoteId() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const w = utils.pad(utils.getWeekNumber(now), 2);
    const prefix = `Q_${y}${w}`;
    const used = state.quotes
      .filter(q => q.quotes_id?.startsWith(prefix))
      .map(q => parseInt(q.quotes_id.slice(6), 10))
      .filter(Number.isFinite);
    for (let i = 1; i <= 99; i++) {
      if (!used.includes(i)) return prefix + utils.pad(i, 2);
    }
    throw new Error('Hết mã báo giá');
  },
  
  contractId() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const w = utils.pad(utils.getWeekNumber(now), 2);
    const prefix = `HD_${y}${w}`;
    const used = state.contracts
      .filter(c => c.contract_id?.startsWith(prefix))
      .map(c => parseInt(c.contract_id.slice(7), 10))
      .filter(Number.isFinite);
    for (let i = 1; i <= 99; i++) {
      if (!used.includes(i)) return prefix + utils.pad(i, 2);
    }
    throw new Error('Hết mã hợp đồng');
  },
  
  paymentId() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = utils.pad(now.getMonth() + 1, 2);
    const prefix = `PM_${y}${m}`;
    const used = state.payments
      .filter(p => p.payment_id?.startsWith(prefix))
      .map(p => parseInt(p.payment_id.slice(6), 10))
      .filter(Number.isFinite);
    for (let i = 1; i <= 999; i++) {
      if (!used.includes(i)) return prefix + utils.pad(i, 3);
    }
    throw new Error('Hết mã thanh toán');
  }
};

// Local Storage Helpers
const storage = {
  getMyCustomerIds() {
    try {
      const map = JSON.parse(localStorage.getItem('myCustomers') || '{}');
      return map[state.currentUser.email] || [];
    } catch {
      return [];
    }
  },
  
  pushMyCustomerId(id) {
    try {
      const map = JSON.parse(localStorage.getItem('myCustomers') || '{}');
      map[state.currentUser.email] = map[state.currentUser.email] || [];
      if (!map[state.currentUser.email].includes(id)) {
        map[state.currentUser.email].push(id);
      }
      localStorage.setItem('myCustomers', JSON.stringify(map));
    } catch {}
  },
  
  getCreatedBy(table) {
    try {
      const data = JSON.parse(localStorage.getItem(`createdBy_${table}`) || '{}');
      return data;
    } catch {
      return {};
    }
  },
  
  setCreatedBy(table, id, email) {
    try {
      const data = this.getCreatedBy(table);
      data[id] = email;
      localStorage.setItem(`createdBy_${table}`, JSON.stringify(data));
    } catch {}
  },
  
  canEdit(table, id) {
    const isElevated = ['admin', 'BOM'].includes(state.currentUser.role);
    if (isElevated) return true;
    
    const createdBy = this.getCreatedBy(table);
    return createdBy[id] === state.currentUser.email;
  }
};

// UI Helpers
const ui = {
  showSection(page) {
    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('d-none'));
    const section = document.getElementById(`page-${page}`);
    if (section) {
      section.classList.remove('d-none');
      section.classList.add('fade-in');
    }
    
    const titles = {
      dashboard: 'Dashboard',
      customers: 'Quản lý khách hàng',
      projects: 'Quản lý dự án',
      opportunities: 'Quản lý cơ hội',
      quotes: 'Quản lý báo giá',
      contracts: 'Quản lý hợp đồng',
      payments: 'Quản lý thanh toán',
      users: 'Quản lý người dùng'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    
    document.querySelectorAll('.sidebar .nav-link').forEach(a => {
      if (a.dataset.page === page) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
    
    if (window.innerWidth < 992) {
      ui.toggleSidebar(false);
    }
  },
  
  toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    
    if (show === undefined) {
      show = !sidebar.classList.contains('show');
    }
    
    if (show) {
      sidebar.classList.add('show');
      backdrop.classList.add('show');
    } else {
      sidebar.classList.remove('show');
      backdrop.classList.remove('show');
    }
  },
  
  setKPIs() {
    document.getElementById('kpiCustomers').textContent = state.customers.length;
    document.getElementById('kpiProjects').textContent = state.projects.length;
    document.getElementById('kpiOpportunities').textContent = state.opportunities.length;
    const totalValue = state.opportunities.reduce((sum, o) => sum + (o.expected_value || 0), 0);
    document.getElementById('kpiOppValue').textContent = utils.money(totalValue) + ' đ';
  },
  
  attachMoneyFormatters() {
    document.querySelectorAll('.money-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const pos = e.target.selectionStart;
        const oldLen = e.target.value.length;
        e.target.value = utils.formatMoney(e.target.value);
        const newLen = e.target.value.length;
        e.target.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
      });
    });
  }
};

// Data Loading
async function loadData() {
  try {
    const [customersRes, projectsRes, opportunitiesRes, quotesRes, contractsRes, paymentsRes, usersRes] = await Promise.all([
      sb.from('customers').select('*').order('id'),
      sb.from('projects').select('*').order('project_id'),
      sb.from('opportunities').select('*').order('opportunity_id'),
      sb.from('quotes').select('*').order('quotes_id'),
      sb.from('contracts').select('*').order('contract_id'),
      sb.from('payments').select('*').order('payment_id'),
      sb.from('user_profiles').select('*')
    ]);

    state.customers = customersRes.data || [];
    state.projects = projectsRes.data || [];
    state.opportunities = opportunitiesRes.data || [];
    state.quotes = quotesRes.data || [];
    state.contracts = contractsRes.data || [];
    state.payments = paymentsRes.data || [];
    state.users = usersRes.data || [];

    // Update cache
    state.cache.customerMap.clear();
    state.customers.forEach(c => state.cache.customerMap.set(c.id, c));
    
    state.cache.projectMap.clear();
    state.projects.forEach(p => state.cache.projectMap.set(p.project_id, p));
    
    state.cache.contractMap.clear();
    state.contracts.forEach(c => state.cache.contractMap.set(c.contract_id, c));
    
  } catch (error) {
    console.error('Error loading data:', error);
    utils.showToast('Lỗi khi tải dữ liệu', 'error');
  }
}

// CRUD Operations
const crud = {
  async create(table, data) {
    try {
      const { error } = await sb.from(table).insert([data]);
      if (error) throw error;
      await loadData();
      utils.showToast('Thêm mới thành công');
      return true;
    } catch (error) {
      utils.showToast(error.message, 'error');
      return false;
    }
  },
  
  async update(table, data, matchColumn, matchValue) {
    try {
      const { error } = await sb.from(table).update(data).eq(matchColumn, matchValue);
      if (error) throw error;
      await loadData();
      utils.showToast('Cập nhật thành công');
      return true;
    } catch (error) {
      utils.showToast(error.message, 'error');
      return false;
    }
  },
  
  async delete(table, matchColumn, matchValue) {
    try {
      const { error } = await sb.from(table).delete().eq(matchColumn, matchValue);
      if (error) throw error;
      await loadData();
      utils.showToast('Xóa thành công');
      return true;
    } catch (error) {
      utils.showToast(error.message, 'error');
      return false;
    }
  }
};

// Payment Calculations
const payments = {
  getContractPayments(contractId) {
    return state.payments.filter(p => p.contract_id === contractId);
  },
  
  getTotalPaid(contractId) {
    const contractPayments = this.getContractPayments(contractId);
    return contractPayments.reduce((sum, p) => {
      if (p.payment_type === 'payment' || p.payment_type === 'advance') {
        return sum + (p.amount || 0);
      }
      return sum;
    }, 0);
  },
  
  getPaymentRate(contractId) {
    const contract = state.cache.contractMap.get(contractId);
    if (!contract || !contract.value) return 0;
    
    const paid = this.getTotalPaid(contractId);
    return Math.min(100, Math.round((paid / contract.value) * 100));
  },
  
  getSummary() {
    const totalReceivable = state.contracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const totalReceived = state.payments
      .filter(p => p.payment_type === 'payment' || p.payment_type === 'advance')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAdvance = state.payments
      .filter(p => p.payment_type === 'advance')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    return {
      totalReceivable,
      totalReceived,
      totalRemaining: totalReceivable - totalReceived,
      totalAdvance
    };
  }
};

// Render Functions
const renderers = {
  dashboard() {
    ui.setKPIs();
  },
  
  customers() {
    const tbody = document.getElementById('customerTbody');
    let list = state.customers;
    
    const isElevated = ['admin', 'BOM'].includes(state.currentUser.role);
    if (!isElevated) {
      const allowedIds = storage.getMyCustomerIds();
      list = state.customers.filter(c => allowedIds.includes(c.id));
    }
    
    tbody.innerHTML = list.map(c => {
      const canEdit = storage.canEdit('customers', c.id);
      return `
        <tr>
          <td><span class="badge badge-primary">${c.id}</span></td>
          <td class="fw-semibold">${c.name || ''}</td>
          <td class="hide-mobile">${c.contact_person || ''}</td>
          <td class="hide-mobile">${c.email || ''}</td>
          <td>
            <div class="btn-group btn-group-sm">
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.customer('${c.id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deleteCustomer('${c.id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : '<span class="text-muted small">Chỉ xem</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  projects() {
    const tbody = document.getElementById('projectTbody');
    tbody.innerHTML = state.projects.map(p => {
      const customer = state.cache.customerMap.get(p.customer_id);
      const canEdit = storage.canEdit('projects', p.project_id);
      
      const statusColors = {
        'Chuẩn bị': 'warning',
        'Đang triển khai': 'info',
        'Hoàn thành': 'success'
      };
      
      return `
        <tr>
          <td><span class="badge badge-primary">${p.project_id}</span></td>
          <td class="fw-semibold">${p.project_name || ''}</td>
          <td class="hide-mobile">${customer ? customer.name : p.customer_id}</td>
          <td><span class="badge badge-${statusColors[p.status] || 'secondary'}">${p.status || ''}</span></td>
          <td>
            <div class="btn-group btn-group-sm">
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.project('${p.project_id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deleteProject('${p.project_id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : '<span class="text-muted small">Chỉ xem</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  opportunities() {
    const tbody = document.getElementById('oppTbody');
    tbody.innerHTML = state.opportunities.map(o => {
      const customer = state.cache.customerMap.get(o.customer_id);
      const canEdit = storage.canEdit('opportunities', o.opportunity_id);
      
      const stageColors = {
        'mới': 'primary',
        'đánh giá': 'info',
        'đàm phán': 'warning',
        'đã thắng': 'success',
        'đã mất': 'danger'
      };
      
      return `
        <tr>
          <td><span class="badge badge-primary">${o.opportunity_id}</span></td>
          <td class="fw-semibold">${o.name || ''}</td>
          <td class="hide-mobile">${customer ? customer.name : o.customer_id}</td>
          <td class="fw-bold text-primary">${utils.money(o.expected_value)} đ</td>
          <td><span class="badge badge-${stageColors[o.stage] || 'secondary'}">${o.stage || ''}</span></td>
          <td>
            <div class="btn-group btn-group-sm">
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.opportunity('${o.opportunity_id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deleteOpportunity('${o.opportunity_id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : '<span class="text-muted small">Chỉ xem</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  quotes() {
    const tbody = document.getElementById('quoteTbody');
    tbody.innerHTML = state.quotes.map(q => {
      const customer = state.cache.customerMap.get(q.customer_id);
      const canEdit = storage.canEdit('quotes', q.quotes_id);
      
      const statusColors = {
        'nháp': 'secondary',
        'đã gửi': 'info',
        'chấp nhận': 'success',
        'từ chối': 'danger'
      };
      
      return `
        <tr>
          <td><span class="badge badge-primary">${q.quotes_id}</span></td>
          <td>${customer ? customer.name : q.customer_id}</td>
          <td class="fw-bold text-primary">${utils.money(q.amount)} đ</td>
          <td><span class="badge badge-${statusColors[q.status] || 'secondary'}">${q.status || ''}</span></td>
          <td>
            <div class="btn-group btn-group-sm">
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.quote('${q.quotes_id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deleteQuote('${q.quotes_id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : '<span class="text-muted small">Chỉ xem</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  contracts() {
    const tbody = document.getElementById('contractTbody');
    tbody.innerHTML = state.contracts.map(ct => {
      const project = state.cache.projectMap.get(ct.project_id);
      const canEdit = storage.canEdit('contracts', ct.contract_id);
      
      const totalPaid = payments.getTotalPaid(ct.contract_id);
      const paymentRate = payments.getPaymentRate(ct.contract_id);
      
      return `
        <tr>
          <td><span class="badge badge-primary">${ct.contract_id}</span></td>
          <td class="fw-semibold">${project ? project.project_name : ct.project_id}</td>
          <td class="fw-bold text-primary">${utils.money(ct.value)} đ</td>
          <td class="fw-bold text-success">${utils.money(totalPaid)} đ</td>
          <td>
            <div class="payment-indicator">
              <div class="progress">
                <div class="progress-bar bg-${paymentRate === 100 ? 'success' : paymentRate > 50 ? 'warning' : 'danger'}" 
                     style="width: ${paymentRate}%"></div>
              </div>
              <span class="badge bg-${paymentRate === 100 ? 'success' : 'warning'}">${paymentRate}%</span>
            </div>
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-success" onclick="showPaymentDetail('${ct.contract_id}')" title="Chi tiết TT">
                <i class="bi bi-cash"></i>
              </button>
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.contract('${ct.contract_id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deleteContract('${ct.contract_id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  payments() {
    // Update summary
    const summary = payments.getSummary();
    document.getElementById('totalReceivable').textContent = utils.money(summary.totalReceivable) + ' đ';
    document.getElementById('totalReceived').textContent = utils.money(summary.totalReceived) + ' đ';
    document.getElementById('totalRemaining').textContent = utils.money(summary.totalRemaining) + ' đ';
    document.getElementById('totalAdvance').textContent = utils.money(summary.totalAdvance) + ' đ';
    
    // Update badge
    const pendingCount = state.contracts.filter(c => payments.getPaymentRate(c.contract_id) < 100).length;
    const badge = document.getElementById('paymentBadge');
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
    
    // Render table
    const tbody = document.getElementById('paymentTbody');
    tbody.innerHTML = state.payments.map(p => {
      const contract = state.cache.contractMap.get(p.contract_id);
      const canEdit = storage.canEdit('payments', p.payment_id);
      
      const typeColors = {
        'advance': 'info',
        'payment': 'success',
        'final': 'primary'
      };
      
      const typeLabels = {
        'advance': 'Tạm ứng',
        'payment': 'Thanh toán',
        'final': 'Quyết toán'
      };
      
      return `
        <tr>
          <td><span class="badge badge-primary">${p.payment_id}</span></td>
          <td>${contract ? contract.contract_id : p.contract_id}</td>
          <td><span class="badge badge-${typeColors[p.payment_type] || 'secondary'}">${typeLabels[p.payment_type] || p.payment_type}</span></td>
          <td class="fw-bold text-success">${utils.money(p.amount)} đ</td>
          <td>${utils.formatDate(p.payment_date)}</td>
          <td>
            <div class="btn-group btn-group-sm">
              ${canEdit ? `
                <button class="btn btn-outline-primary" onclick="crmForms.payment('${p.payment_id}')" title="Sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="handlers.deletePayment('${p.payment_id}')" title="Xóa">
                  <i class="bi bi-trash"></i>
                </button>
              ` : '<span class="text-muted small">Chỉ xem</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  users() {
    const me = state.users.find(u => u.email === state.currentUser.email);
    const canSee = me && ['admin', 'BOM'].includes(me.role);
    document.getElementById('navUsers').style.display = canSee ? '' : 'none';
    
    const tbody = document.getElementById('userTbody');
    tbody.innerHTML = state.users.map(u => {
      const roleColors = {
        'admin': 'danger',
        'BOM': 'warning',
        'user': 'info'
      };
      
      return `
        <tr>
          <td>${u.email}</td>
          <td><span class="badge badge-${roleColors[u.role] || 'secondary'}">${u.role || ''}</span></td>
