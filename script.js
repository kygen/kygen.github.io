(function(){
  const STORAGE_KEY = 'homeInventory.v7';
  const ADD_NEW_VALUE = '__add_new__';
  const DEFAULT_CATS = ['ألبان','أجبان','بقوليات','حبوب/أرز','معلبات','مكرونة','منظفات','لحوم','دواجن','أسماك'];
  const DEFAULT_LOCS = ['المطبخ','الثلاجة','الفريزر','المخزن'];
  const LOCAL_BARCODE_DB_URL = 'assets/egyptian-products.json';
  let localBarcodeDB = {};

  // Safe ID generator with fallback for browsers lacking crypto.randomUUID
  function generateId(){
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    let i = 0;
    const random = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(16)) : null;
    return template.replace(/[xy]/g, c => {
      let r = random ? random[i++] & 15 : Math.random()*16;
      if(c === 'y') r = (r & 0x3) | 0x8;
      return r.toString(16);
    });
  }

  // Check for localStorage availability
  function storageAvailable(){
    try{
      const test='__test__';
      localStorage.setItem(test,test);
      localStorage.removeItem(test);
      return true;
    }catch(e){ return false; }
  }
  const canStore = storageAvailable();

  /** @type {{items: Array, categories: string[], locations: string[], history: Array}} */
  let state = load() || migrateUp() || { items: [], categories: [...DEFAULT_CATS], locations: [...DEFAULT_LOCS], history: [] };
  state.locations = state.locations || [...DEFAULT_LOCS];
  let editId = null;
  let withdrawSelectedId = null;

  // History pagination
  const HISTORY_PAGE_SIZE = 10;
  let historyPage = 1;

  const $ = (sel)=>document.querySelector(sel);

  // Form refs
  const nameInput = $('#name');
  const categorySelect = $('#categorySelect');
  const customCatRow = $('#customCatRow');
  const customCatInput = $('#categoryCustom');
  const locationSelect = $('#locationSelect');
  const customLocRow = $('#customLocRow');
  const customLocInput = $('#locationCustom');
  const unitTypeSelect = $('#unitType');
  const qtyInput = $('#quantity');
  const weightUnitWrap = $('#weightUnitWrap');
  const pieceUnitWrap = $('#pieceUnitWrap');
  const weightUnitSelect = $('#weightUnit');
  const thresholdInput = $('#threshold');
  const thresholdUnitBadge = $('#thresholdUnitBadge');
  const dateAddedInput = $('#dateAdded');
  const editHint = $('#editHint');
  const barcodeInput = $('#barcode');
  const scanBtn = $('#scanBtn');
  const scanModal = $('#scanModal');
  const scanner = $('#scanner');
  const closeScanBtn = $('#closeScanBtn');

  // Lists UI
  const itemsWrap = $('#itemsWrap');
  const itemsBody = $('#itemsBody');
  const itemsTable = $('#itemsTable');
  const searchInput = $('#search');
  const filterUnit = $('#filterUnit');
  const filterLocation = $('#filterLocation');

  // Low Modal
  const lowModal = $('#lowModal');
  const lowWrap = $('#lowWrap');
  const lowBody = $('#lowBody');
  const lowTable = $('#lowTable');
  const lowSearch = $('#lowSearch');
  const toggleLowBtn = $('#toggleLowBtn');
  const closeLowBtn = $('#closeLowBtn');
  const adminBtn = $('#adminBtn');
  const jsonControls = $('#jsonControls');
  const exportBtn = $('#exportBtn');
  const importBtn = document.querySelector('label[for="importFile"]');
  const clearAllBtn = $('#clearAllBtn');

  // Withdraw Modal
  const withdrawModal = $('#withdrawModal');
  const toggleWithdrawBtn = $('#toggleWithdrawBtn');
  const closeWithdrawBtn = $('#closeWithdrawBtn');
  const withdrawName = $('#withdrawName');
  const withdrawNameList = $('#withdrawNameList');
  const withdrawSelect = $('#withdrawSelect');
  const withdrawInfo = $('#withdrawInfo');
  const availableLabel = $('#availableLabel');
  const unitLabel = $('#unitLabel');
  const afterLabel = $('#afterLabel');
  const withdrawAmount = $('#withdrawAmount');
  const withdrawError = $('#withdrawError');
  const doWithdrawBtn = $('#doWithdrawBtn');
  const withdrawResetBtn = $('#withdrawResetBtn');

  // History UI
  const toggleHistoryBtn = $('#toggleHistoryBtn');
  const historyWrap = $('#historyWrap');
  const historyTblWrap = $('#historyTblWrap');
  const historyBody = $('#historyBody');
  const histPrev = $('#histPrev');
  const histNext = $('#histNext');
  const historyInfo = $('#historyInfo');

  let sortState = { key:'name', dir:'asc' };
  let lowSortState = { key:'name', dir:'asc' };

  // ===== Storage / Migration =====
  function save(){
    if(!canStore){ toast('⚠️ لا يمكن حفظ البيانات — التخزين غير متاح'); render(); return; }
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){
      console.warn('Save failed', e);
      toast('⚠️ فشل حفظ البيانات');
    }
    render();
  }
  function load(){
    if(!canStore) return null;
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ console.warn('Load failed', e); return null; }
  }
  async function loadLocalBarcodeDB(){
    try{
      const res = await fetch(LOCAL_BARCODE_DB_URL);
      localBarcodeDB = await res.json();
    }catch(err){
      console.warn('Failed to load local barcode DB', err);
      toast('⚠️ فشل تحميل قاعدة الباركود المحلية');
    }
  }
  function migrateUp(){
    try{
      const raw6 = localStorage.getItem('homeInventory.v6');
      if(raw6){
        const v6 = JSON.parse(raw6);
        if(v6 && Array.isArray(v6.items)){
          const v7 = { items: v6.items, categories: v6.categories || [...DEFAULT_CATS], locations: v6.locations || [...DEFAULT_LOCS], history: v6.history || [] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(v7));
          return v7;
        }
      }
      const raw5 = localStorage.getItem('homeInventory.v5');
      if(raw5){
        const v5 = JSON.parse(raw5);
        if(v5 && Array.isArray(v5.items)){
          const v7 = { items: v5.items, categories: v5.categories || [...DEFAULT_CATS], locations: v5.locations || [...DEFAULT_LOCS], history: v5.history || [] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(v7));
          return v7;
        }
      }
      return null;
    }catch(e){ return null; }
  }

  // ===== Utils =====
  function normalize(str){ return (str||'').toString().trim().replace(/\s+/g,' ').toLowerCase(); }
  function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); }
  function dedupeCats(arr){
    const seen = new Set(), out = [];
    for(const c of arr){
      const key = normalize(c); if(!key) continue;
      if(!seen.has(key)){ seen.add(key); out.push(c.trim()); }
    }
    return out.sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function displayUnit(item){ return item.unitType==='piece' ? 'قطعة' : (item.weightUnit || 'كجم'); }
  function formatQtyVal(n){ const q=Number(n||0); return Number.isInteger(q) ? q.toString() : q.toFixed(2).replace(/\.00$/,''); }
  function formatQty(item, val){ return `${formatQtyVal(val ?? item.quantity)} ${displayUnit(item)}`; }
  function toast(msg, ms=3500){ const t=$('#toast'), tm=$('#toastMsg'); tm.textContent=msg; t.style.display='grid'; setTimeout(()=>{t.style.display='none'}, ms); }

  function todayLocalISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function formatDate(dstr){
    if(!dstr) return '<span class="muted">—</span>';
    const d=new Date(dstr); return isNaN(d) ? '<span class="muted">—</span>' : d.toLocaleDateString('ar-EG');
  }

  // base conversion for comparison (grams/pieces)
  function toBase(item,value){
    if(item.unitType==='weight'){
      const v=Number(value||0);
      return (item.weightUnit||'كجم')==='كجم' ? v*1000 : v;
    }
    return Number(value||0);
  }
  function hasThreshold(item){ const t=Number(item.threshold); return !Number.isNaN(t) && t>0; }
  function isLowStock(item){
    const qtyBase = toBase(item, item.quantity);
    if(qtyBase === 0) return true;
    return hasThreshold(item) && qtyBase <= toBase(item, item.threshold);
  }
  function shortageAmount(item){
    if(!hasThreshold(item)) return 0;
    const diffBase=toBase(item,item.threshold)-toBase(item,item.quantity);
    if(diffBase<=0) return 0;
    return item.unitType==='weight' ? ((item.weightUnit||'كجم')==='كجم' ? diffBase/1000 : diffBase) : diffBase;
  }

  // ===== Categories =====
  function buildCategoryOptions(selectedValue=''){
    const merged = dedupeCats([...state.categories, ...state.items.map(i => (i.category||'').trim()).filter(Boolean)]);
    state.categories = merged;
    const opts = [
      `<option value="" ${selectedValue===''?'selected':''}>— بدون تصنيف —</option>`,
      ...merged.map(c => `<option value="${escapeHtml(c)}" ${selectedValue===c?'selected':''}>${escapeHtml(c)}</option>`),
      `<option value="__add_new__" ${selectedValue==='__add_new__'?'selected':''}>➕ إضافة تصنيف جديد…</option>`
    ];
    categorySelect.innerHTML = opts.join('');
  }
  function ensureCustomFieldVisibility(){
    if(categorySelect.value === '__add_new__'){ customCatRow.style.display='grid'; customCatInput.focus(); }
    else { customCatRow.style.display='none'; customCatInput.value=''; }
  }

  function buildLocationOptions(selectedValue=''){
    const merged = dedupeCats([...state.locations, ...state.items.map(i => (i.location||'').trim()).filter(Boolean)]);
    state.locations = merged;
    const opts = [
      `<option value="" ${selectedValue===''?'selected':''}>— بدون موقع —</option>`,
      ...merged.map(l=>`<option value="${escapeHtml(l)}" ${selectedValue===l?'selected':''}>${escapeHtml(l)}</option>`),
      `<option value="__add_new__" ${selectedValue==='__add_new__'?'selected':''}>➕ إضافة موقع جديد…</option>`
    ];
    locationSelect.innerHTML = opts.join('');
    const filterSel = filterLocation.value;
    filterLocation.innerHTML = [`<option value="">كل المواقع</option>`, ...merged.map(l=>`<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`)].join('');
    filterLocation.value = filterSel;
  }
  function ensureLocationFieldVisibility(){
    if(locationSelect.value === ADD_NEW_VALUE){ customLocRow.style.display='grid'; customLocInput.focus(); }
    else { customLocRow.style.display='none'; customLocInput.value=''; }
  }

  function initSort(table, state, fn){
    table.querySelectorAll('th[data-sort]').forEach(th=>{
      th.dataset.label = th.textContent.trim();
      th.addEventListener('click', ()=>{
        const key = th.dataset.sort;
        if(state.key === key){ state.dir = state.dir==='asc'?'desc':'asc'; }
        else { state.key = key; state.dir = 'asc'; }
        fn();
      });
    });
  }
  function updateSortIndicators(table, state){
    table.querySelectorAll('th[data-sort]').forEach(th=>{
      th.textContent = th.dataset.label + (state.key===th.dataset.sort ? (state.dir==='asc'?' ▲':' ▼') : '');
    });
  }

  // ===== Render =====
  function render(){
    const query = normalize(searchInput.value);
    const unitFilter = filterUnit.value;
    const locFilter = filterLocation.value;

    const items = state.items
      .map((item, idx)=>({ ...item, __index: idx }))
      .filter(i=>{
        const mS = !query || normalize(i.name).includes(query) || normalize(i.category||'').includes(query) || normalize(i.location||'').includes(query);
        const mU = !unitFilter || i.unitType===unitFilter;
        const mL = !locFilter || i.location === locFilter;
        return mS && mU && mL;
      })
      .sort((a,b)=>{
        let cmp = 0;
        switch(sortState.key){
          case 'index': cmp = a.__index - b.__index; break;
          case 'name': cmp = a.name.localeCompare(b.name,'ar'); break;
          case 'category': cmp = (a.category||'').localeCompare(b.category||'','ar'); break;
          case 'location': cmp = (a.location||'').localeCompare(b.location||'','ar'); break;
          case 'quantity': cmp = (a.quantity||0) - (b.quantity||0); break;
          case 'threshold': cmp = ((a.threshold??Infinity) - (b.threshold??Infinity)); break;
          case 'unit': cmp = a.unitType.localeCompare(b.unitType,'ar'); break;
          case 'date': cmp = (a.dateAdded||'').localeCompare(b.dateAdded||''); break;
        }
        return sortState.dir==='asc' ? cmp : -cmp;
      });

    itemsBody.innerHTML = items.length
      ? items.map((item, idx)=>{
          const thr = hasThreshold(item) ? formatQty(item, item.threshold) : '<span class="muted">—</span>';
          const lowClass = isLowStock(item) ? 'style="background:rgba(245,158,11,.08)"' : '';
          return `<tr ${lowClass}>
            <td>${idx+1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.category ? `<span class="tag">${escapeHtml(item.category)}</span>` : '<span class="muted">—</span>'}</td>
            <td>${item.location ? `<span class="tag">${escapeHtml(item.location)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="qty">${formatQty(item)}</td>
            <td class="qty">${thr}</td>
            <td>${item.unitType==='piece' ? 'بالقطعة' : 'بالوزن'}</td>
            <td>${formatDate(item.dateAdded)}</td>
            <td class="actions">
              <button class="btn" data-act="edit" data-id="${item.id}">تعديل</button>
              <button class="btn" data-act="withdraw" data-id="${item.id}">سحب</button>
              <button class="btn danger" data-act="delete" data-id="${item.id}">حذف</button>
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="9" class="dim">لا توجد نتائج مطابقة لبحثك.</td></tr>`;

    updateSortIndicators(itemsTable, sortState);

    renderLowList();
    updateBadges();
    updateScrollStates(items.length, state.items.filter(isLowStock).length);

    const currentCat = categorySelect.value;
    const currentLoc = locationSelect.value;
    buildCategoryOptions(currentCat);
    buildLocationOptions(currentLoc);
    ensureCustomFieldVisibility();
    ensureLocationFieldVisibility();
    buildWithdrawLists();

    if(historyWrap.style.display!=='none') renderHistoryPage();
  }

  function renderLowList(){
    const q = lowSearch.value.trim().toLowerCase();
    const lows = state.items
      .map((item, idx)=>({ ...item, __index: idx }))
      .filter(isLowStock)
      .filter(item=>{
        if(!q) return true;
        return item.name.toLowerCase().includes(q) || (item.category||'').toLowerCase().includes(q);
      })
      .sort((a,b)=>{
        let cmp = 0;
        switch(lowSortState.key){
          case 'index': cmp = a.__index - b.__index; break;
          case 'name': cmp = a.name.localeCompare(b.name,'ar'); break;
          case 'category': cmp = (a.category||'').localeCompare(b.category||'','ar'); break;
          case 'quantity': cmp = (a.quantity||0) - (b.quantity||0); break;
          case 'threshold': cmp = ((a.threshold??Infinity) - (b.threshold??Infinity)); break;
          case 'needed': cmp = shortageAmount(a) - shortageAmount(b); break;
        }
        return lowSortState.dir==='asc' ? cmp : -cmp;
      });
    lowBody.innerHTML = lows.length
      ? lows.map((item, idx)=>{
          const needed = shortageAmount(item);
          const neededStr = needed>0 ? `${formatQtyVal(needed)} ${displayUnit(item)}` : '<span class="muted">—</span>';
          return `<tr>
            <td>${idx+1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.category ? `<span class="tag">${escapeHtml(item.category)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="qty">${formatQty(item)}</td>
            <td class="qty">${hasThreshold(item) ? formatQty(item, item.threshold) : '<span class="muted">—</span>'}</td>
            <td class="qty">${neededStr}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="6" class="dim">لا توجد أصناف منخفضة حاليًا.</td></tr>`;
    updateSortIndicators(lowTable, lowSortState);
    updateScrollStates(state.items.length, lows.length);
  }

  function syncTopButtonSizes(){
    toggleLowBtn.style.width = '';
    toggleLowBtn.style.height = '';
    const rect = toggleLowBtn.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    [toggleLowBtn, toggleWithdrawBtn, exportBtn, importBtn, clearAllBtn].forEach(btn => {
      if(btn){
        btn.style.width = `${width}px`;
        btn.style.height = `${height}px`;
      }
    });
  }

  function updateBadges(){
    const count = state.items.filter(isLowStock).length;
    toggleLowBtn.textContent = `قائمة النواقص (${count})`;
    syncTopButtonSizes();
  }

  // ===== Scroll states (>=10 rows) =====
  function updateScrollStates(mainCount, lowCount){
    if(itemsWrap){
      if(mainCount > 10){ itemsWrap.classList.add('scroll'); }
      else { itemsWrap.classList.remove('scroll'); itemsWrap.scrollTop = 0; }
    }
    if(lowWrap){
      if(lowCount > 10){ lowWrap.classList.add('scroll'); }
      else { lowWrap.classList.remove('scroll'); lowWrap.scrollTop = 0; }
    }
  }

  // ===== Form helpers =====
  function clearForm(){
    editId = null; editHint.style.display='none';
    $('#itemForm').reset();
    unitTypeSelect.value='piece';
    dateAddedInput.value = todayLocalISO();
    barcodeInput.value='';
    quantityChangedUI();
    buildCategoryOptions('');
    buildLocationOptions('');
    ensureCustomFieldVisibility();
    ensureLocationFieldVisibility();
    nameInput.focus();
  }
  function duplicateOf(name){ const key=normalize(name); return state.items.find(i=>normalize(i.name)===key); }
  function startEdit(id){
    const item = state.items.find(i=>i.id===id); if(!item) return;
    editId = id; editHint.style.display='inline';
    nameInput.value = item.name || '';
    if(item.category && !state.categories.map(normalize).includes(normalize(item.category))){
      state.categories.push(item.category); state.categories = dedupeCats(state.categories);
    }
    if(item.location && !state.locations.map(normalize).includes(normalize(item.location))){
      state.locations.push(item.location); state.locations = dedupeCats(state.locations);
    }
    buildCategoryOptions(item.category || '');
    buildLocationOptions(item.location || '');
    ensureCustomFieldVisibility();
    ensureLocationFieldVisibility();
    unitTypeSelect.value = item.unitType || 'piece';
    qtyInput.value = item.quantity ?? '';
    weightUnitSelect.value = item.weightUnit || 'كجم';
    thresholdInput.value = item.threshold ?? '';
    dateAddedInput.value = item.dateAdded ? item.dateAdded.slice(0,10) : todayLocalISO();
    barcodeInput.value = item.barcode || '';
    quantityChangedUI(); nameInput.focus();
    // لو فتحنا من نافذة النواقص، نقفلها عشان نركز في التعديل
    if(lowModal.classList.contains('show')) closeLowModal();
  }
  function addItem(data){
    const dupe = duplicateOf(data.name);
    if (dupe) {
      toast(
        `⚠️ الصنف "${dupe.name}" موجود بالفعل. كميته الحالية: ${formatQty(
          dupe
        )}. يمكنك تعديله بدلًا من إضافته.`,
        10000
      );
      startEdit(dupe.id);
      return false;
    }
    if (data.barcode) {
      const bar = state.items.find((i) => i.barcode === data.barcode);
      if (bar) {
        toast(
          `⚠️ يوجد صنف بنفس الباركود: "${bar.name}". سيتم فتحه للتعديل.`,
          10000
        );
        startEdit(bar.id);
        return false;
      }
    }
    if(data.location && !state.locations.map(normalize).includes(normalize(data.location))){
      state.locations.push(data.location); state.locations = dedupeCats(state.locations);
    }
    data.id = generateId(); state.items.push(data); save(); toast('✅ تم إضافة الصنف بنجاح'); return true;
  }
  function updateItem(id, patch){
    const idx = state.items.findIndex(i=>i.id===id); if(idx<0) return;
    if(patch.name && normalize(patch.name)!==normalize(state.items[idx].name)){
      const dupe = duplicateOf(patch.name); if(dupe && dupe.id!==id){ toast(`⚠️ لا يمكن تغيير الاسم إلى "${patch.name}" لأنه موجود لصنف آخر.`); return; }
    }
    if(patch.barcode && patch.barcode !== state.items[idx].barcode){
      const dupBar = state.items.find(i=>i.barcode === patch.barcode);
      if(dupBar && dupBar.id!==id){ toast('⚠️ هذا الباركود مرتبط بصنف آخر.'); return; }
    }
    state.items[idx] = {...state.items[idx], ...patch};
    if(patch.location && !state.locations.map(normalize).includes(normalize(patch.location))){
      state.locations.push(patch.location); state.locations = dedupeCats(state.locations);
    }
    save(); toast('✏️ تم تعديل الصنف');
  }
  function deleteItem(id){
    const item = state.items.find(i=>i.id===id); if(!item) return;
    if(confirm(`سيتم حذف "${item.name}" بالكامل من المخزون. هل أنت متأكد؟`)){
      state.items = state.items.filter(i=>i.id!==id); save(); toast('🗑️ تم حذف الصنف');
    }
  }

  // ===== Withdraw =====
  function buildWithdrawLists(){
    const names = [...state.items].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(i=>i.name);
    withdrawNameList.innerHTML = names.map(n=>`<option value="${escapeHtml(n)}"></option>`).join('');
    withdrawSelect.innerHTML = [
      `<option value="">— اختر صنف —</option>`,
      ...state.items.sort((a,b)=>a.name.localeCompare(b.name,'ar'))
        .map(i=>`<option value="${i.id}" ${withdrawSelectedId===i.id?'selected':''}>${escapeHtml(i.name)}</option>`)
    ].join('');
  }
  function getItemById(id){ return state.items.find(i=>i.id===id) || null; }
  function getItemByName(name){ const key=normalize(name); return state.items.find(i=>normalize(i.name)===key) || null; }
  function stepFor(item){ if(!item) return 1; if(item.unitType==='piece') return 1; return (item.weightUnit||'كجم')==='جم' ? 1 : 0.01; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function roundQty(n,item){
    if(item.unitType==='piece') return Math.round(n);
    if((item.weightUnit||'كجم')==='جم') return Math.round(n);
    return Math.round(n*1000)/1000;
  }
  function showWithdrawInfo(item){
    if(!item){ withdrawInfo.style.display='none'; return; }
    withdrawInfo.style.display='block';
    availableLabel.textContent = formatQty(item);
    unitLabel.textContent = displayUnit(item);
    withdrawAmount.value=''; withdrawAmount.step=stepFor(item); withdrawAmount.min=0; withdrawAmount.max=item.quantity;
    withdrawError.style.display='none'; doWithdrawBtn.disabled=true;
    afterLabel.textContent = formatQty(item, item.quantity);
  }
  function selectWithdrawItemById(id){
    const item = getItemById(id); withdrawSelectedId = item ? item.id : null;
    withdrawSelect.value = item ? item.id : ''; withdrawName.value = item ? item.name : '';
    showWithdrawInfo(item);
  }
  function onWithdrawAmountInput(){
    const item = getItemById(withdrawSelectedId);
    if(!item){ doWithdrawBtn.disabled = true; return; }
    let v = Number(withdrawAmount.value || 0); if(Number.isNaN(v) || v<0) v=0;
    const max = Number(item.quantity); const valid = v>0 && v<=max;
    withdrawError.style.display = valid ? 'none' : (v>max ? 'inline' : 'none');
    doWithdrawBtn.disabled = !valid;
    const remaining = roundQty(item.quantity - clamp(v,0,max), item);
    afterLabel.textContent = formatQty(item, remaining);
  }
  function performWithdraw(){
    const item = getItemById(withdrawSelectedId); if(!item) return;
    let amount = Number(withdrawAmount.value || 0);
    if(Number.isNaN(amount) || amount<=0){ toast('⚠️ أدخل كمية صحيحة للسحب.'); return; }
    if(amount > item.quantity){ toast('❌ لا يمكن سحب أكثر من المتاح.'); return; }
    amount = roundQty(amount, item); const newQty = roundQty(item.quantity - amount, item);
    updateItem(item.id, { quantity: newQty });
    state.history = state.history || [];
    state.history.unshift({ id: generateId(), itemId: item.id, name: item.name, unit: displayUnit(item), amount, after: newQty, at: new Date().toISOString() });
    if(state.history.length>500) state.history.length=500;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    historyPage = 1; render(); selectWithdrawItemById(item.id);
    withdrawAmount.value=''; doWithdrawBtn.disabled=true;
    toast(`✅ تم سحب ${formatQty(item, amount)} من "${item.name}".`);
  }

  // ===== History pagination =====
  function totalHistoryPages(){ const n=(state.history||[]).length; return Math.max(1, Math.ceil(n / HISTORY_PAGE_SIZE)); }
  function renderHistoryPage(){
    const hist = state.history || []; const pages = totalHistoryPages();
    historyPage = Math.min(Math.max(1, historyPage), pages);
    if(hist.length===0){
      historyBody.innerHTML = `<tr><td colspan="4" class="dim">لا يوجد عمليات سحب بعد.</td></tr>`;
      historyInfo.textContent = `الصفحة 1/1`; histPrev.disabled = true; histNext.disabled = true; historyTblWrap.classList.remove('scroll'); return;
    }
    const start=(historyPage-1)*HISTORY_PAGE_SIZE, end=start+HISTORY_PAGE_SIZE, pageItems=hist.slice(start,end);
    historyBody.innerHTML = pageItems.map(h=>{
      const when = new Date(h.at).toLocaleString('ar-EG');
      return `<tr>
        <td>${when}</td>
        <td>${escapeHtml(h.name)}</td>
        <td class="qty">${formatQtyVal(h.amount)} ${escapeHtml(h.unit||'')}</td>
        <td class="qty">${formatQtyVal(h.after)} ${escapeHtml(h.unit||'')}</td>
      </tr>`;
    }).join('');
    historyInfo.textContent = `الصفحة ${historyPage}/${pages}`;
    histPrev.disabled = (historyPage<=1); histNext.disabled = (historyPage>=pages);
    historyTblWrap.classList.remove('scroll');
  }

  // ===== Events: Add/Edit form =====
  function quantityChangedUI(){
    const isWeight = unitTypeSelect.value==='weight';
    weightUnitWrap.style.display = isWeight ? 'block' : 'none';
    pieceUnitWrap.style.display = isWeight ? 'none' : 'block';
    thresholdUnitBadge.textContent = isWeight ? (weightUnitSelect.value || 'كجم') : 'قطعة';
  }
  unitTypeSelect.addEventListener('change', quantityChangedUI);
  weightUnitSelect.addEventListener('change', ()=>{ if(unitTypeSelect.value==='weight'){ thresholdUnitBadge.textContent = weightUnitSelect.value || 'كجم'; }});
  categorySelect.addEventListener('change', ensureCustomFieldVisibility);
  locationSelect.addEventListener('change', ensureLocationFieldVisibility);
  nameInput.addEventListener('blur', ()=>{
    const val = nameInput.value.trim();
    if(!val) return;
    const dupe = duplicateOf(val);
    if(dupe && dupe.id!==editId){ toast(`⚠️ الصنف "${dupe.name}" موجود بالفعل.`); }
  });
  $('#resetBtn').addEventListener('click', clearForm);

  // ===== Search / Filter FIX =====
  // تشغيل البحث الفوري + فلترة النوع + ESC لمسح البحث
  searchInput.addEventListener('input', render);
  filterUnit.addEventListener('change', render);
  filterLocation.addEventListener('change', render);
  searchInput.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ searchInput.value=''; render(); }});

  // default date today
  dateAddedInput.value = todayLocalISO();

  $('#itemForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    let categoryValue='';
    if(categorySelect.value===ADD_NEW_VALUE){
      const proposed=(customCatInput.value||'').trim();
      if(!proposed){ toast('⚠️ من فضلك اكتب اسم التصنيف الجديد.'); customCatInput.focus(); return; }
      if(!state.categories.map(normalize).includes(normalize(proposed))){
        state.categories.push(proposed); state.categories = dedupeCats(state.categories);
      }
      categoryValue = proposed;
    }else{ categoryValue = categorySelect.value || ''; }

    let locationValue='';
    if(locationSelect.value===ADD_NEW_VALUE){
      const proposed=(customLocInput.value||'').trim();
      if(!proposed){ toast('⚠️ من فضلك اكتب اسم الموقع الجديد.'); customLocInput.focus(); return; }
      if(!state.locations.map(normalize).includes(normalize(proposed))){
        state.locations.push(proposed); state.locations = dedupeCats(state.locations);
      }
      locationValue = proposed;
    }else{ locationValue = locationSelect.value || ''; }

    let dateAdded = (dateAddedInput.value||'').trim(); if(!dateAdded) dateAdded = todayLocalISO();

    const data = {
      name: nameInput.value.trim(), category: categoryValue, location: locationValue,
      unitType: unitTypeSelect.value,
      quantity: Number(qtyInput.value || 0),
      weightUnit: unitTypeSelect.value==='weight' ? (weightUnitSelect.value || 'كجم') : null,
      threshold: (thresholdInput.value === '' ? null : Number(thresholdInput.value)),
      dateAdded,
      barcode: (barcodeInput.value||'').trim() || null
    };
    if(!data.name){ toast('⚠️ اكتب اسم الصنف.'); nameInput.focus(); return; }

    if(data.unitType==='piece'){ data.quantity = Math.max(0, Math.round(data.quantity)); }
    else { if((data.weightUnit||'كجم')==='جم') data.quantity = Math.max(0, Math.round(data.quantity));
           else data.quantity = Math.max(0, Math.round(data.quantity*1000)/1000); }

    if(editId){ updateItem(editId, data); clearForm(); }
    else { if(addItem(data)) clearForm(); }
  });

  // ===== Actions from table =====
  document.body.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const act = btn.getAttribute('data-act'), id = btn.getAttribute('data-id');
    if(act==='edit'){ startEdit(id); window.scrollTo({top:0, behavior:'smooth'}); }
    if(act==='delete'){ deleteItem(id); }
    if(act==='withdraw'){ openWithdrawModal(id); }
  });

  // ===== Open/Close Low Modal =====
  function openLowModal(){
    lowSearch.value='';
    renderLowList();
    lowModal.classList.add('show'); lowModal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeLowModal(){
    lowModal.classList.remove('show'); lowModal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  toggleLowBtn.addEventListener('click', openLowModal);
  closeLowBtn.addEventListener('click', closeLowModal);
  lowModal.addEventListener('click', (e)=>{ if(e.target===lowModal) closeLowModal(); });
  lowSearch.addEventListener('input', renderLowList);

  // ===== Admin Tools Toggle =====
  adminBtn.addEventListener('click', ()=>{
    jsonControls.classList.toggle('show');
    syncTopButtonSizes();
  });

  window.addEventListener('resize', syncTopButtonSizes);

  // ===== Open/Close Withdraw Modal =====
  function openWithdrawModal(preselectId=null){
    buildWithdrawLists();
    if(preselectId){ selectWithdrawItemById(preselectId); }
    else {
      withdrawSelectedId=null; withdrawSelect.value=''; withdrawName.value='';
      withdrawInfo.style.display='none'; doWithdrawBtn.disabled=true; withdrawAmount.value='';
    }
    historyWrap.style.display='none'; toggleHistoryBtn.textContent='إظهار سجل السحب';
    withdrawModal.classList.add('show'); withdrawModal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function closeWithdrawModal(){
    withdrawModal.classList.remove('show'); withdrawModal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  toggleWithdrawBtn.addEventListener('click', ()=>openWithdrawModal());
  closeWithdrawBtn.addEventListener('click', closeWithdrawModal);
  withdrawModal.addEventListener('click', (e)=>{ if(e.target===withdrawModal) closeWithdrawModal(); });

  // ===== Open/Close Scan Modal =====
  async function openScanModal(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      toast('⚠️ المتصفح لا يدعم الكاميرا');
      return;
    }
    scanModal.classList.add('show'); scanModal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';

    const baseConfig = {
      inputStream: {
        type: 'LiveStream',
        target: scanner,
        constraints: { facingMode: 'environment' },
        area: { top: 0.3, right: 0.85, left: 0.15, bottom: 0.7 }
      },
      decoder: { readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'] },
      locate: true
    };

    function initScanner(cfg){
      Quagga.init(cfg, err => {
        if(err){
          console.error(err);
          // retry with workers disabled if first attempt fails (e.g. due to cross-origin)
          if(cfg.numOfWorkers !== 0){
            initScanner({ ...cfg, numOfWorkers: 0 });
            return;
          }
          toast('⚠️ تعذر تشغيل الكاميرا');
          closeScanModal();
          return;
        }
        Quagga.start();
      });
    }

    initScanner({ ...baseConfig, numOfWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 0 });
  }
  function closeScanModal(){
    try{ Quagga.stop(); }catch(e){}
    scanModal.classList.remove('show'); scanModal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
  scanBtn.addEventListener('click', openScanModal);
  closeScanBtn.addEventListener('click', closeScanModal);
  scanModal.addEventListener('click', (e)=>{ if(e.target===scanModal) closeScanModal(); });

  async function fetchProductData(code){
    barcodeInput.value = code;
    const existing = state.items.find(i=>i.barcode === code);
    if(existing){
      toast(`📦 تم العثور على الصنف "${existing.name}"`);
      startEdit(existing.id);
      return;
    }
    const local = localBarcodeDB[code];
    if(local){
      nameInput.value = local.name || code;
      const cat = local.category || '';
      buildCategoryOptions(cat);
      if(cat && categorySelect.value !== cat){
        categorySelect.value = '__add_new__';
        customCatInput.value = cat;
      }
      ensureCustomFieldVisibility();
      toast('✅ تم جلب بيانات المنتج المحلي. تأكد منها ثم احفظ.');
      nameInput.focus();
      return;
    }
    toast('✅ تم قراءة الباركود. جارٍ جلب البيانات…');
    try{
      const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await r.json();
      if(data.status===1){
        const product = data.product || {};
        nameInput.value = product.product_name || code;
        const cat = product.categories ? product.categories.split(',')[0].trim() : '';
        buildCategoryOptions(cat);
        if(cat && categorySelect.value !== cat){
          categorySelect.value = '__add_new__';
          customCatInput.value = cat;
        }
        ensureCustomFieldVisibility();
        toast('✅ تم جلب بيانات المنتج. تأكد منها ثم احفظ.');
        nameInput.focus();
        return;
      }
    }catch(err){
      console.error(err);
    }
    try{
      const r2 = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
      const data2 = await r2.json();
      if(data2 && Array.isArray(data2.items) && data2.items.length){
        const prod = data2.items[0];
        nameInput.value = prod.title || code;
        const cat = prod.category || '';
        buildCategoryOptions(cat);
        if(cat && categorySelect.value !== cat){
          categorySelect.value = '__add_new__';
          customCatInput.value = cat;
        }
        ensureCustomFieldVisibility();
        toast('✅ تم جلب بيانات المنتج. تأكد منها ثم احفظ.');
      }else{
        nameInput.value = code;
        toast('⚠️ لم يتم العثور على تفاصيل المنتج. أدخل البيانات يدويًا.');
      }
    }catch(err){
      console.error(err);
      nameInput.value = code;
      toast('⚠️ فشل جلب بيانات المنتج. أدخل البيانات يدويًا.');
    }
    nameInput.focus();
  }

  Quagga.onDetected(async (res)=>{
    const code = res?.codeResult?.code;
    if(!code) return;
    closeScanModal();
    await fetchProductData(code);
  });

  // ESC closes any open modal
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      if(lowModal.classList.contains('show')) closeLowModal();
      if(withdrawModal.classList.contains('show')) closeWithdrawModal();
      if(scanModal.classList.contains('show')) closeScanModal();
    }
  });

  // ===== Withdraw UI events =====
  withdrawSelect.addEventListener('change', ()=>{ const id=withdrawSelect.value||null; selectWithdrawItemById(id); });
  withdrawName.addEventListener('change', ()=>{ const item=getItemByName(withdrawName.value); selectWithdrawItemById(item?item.id:null); });
  withdrawAmount.addEventListener('input', onWithdrawAmountInput);
  doWithdrawBtn.addEventListener('click', performWithdraw);
  withdrawResetBtn.addEventListener('click', ()=>{
    withdrawName.value=''; withdrawSelect.value=''; withdrawSelectedId=null; withdrawAmount.value='';
    withdrawInfo.style.display='none'; doWithdrawBtn.disabled=true;
  });

  // ===== History toggle + pagination =====
  toggleHistoryBtn.addEventListener('click', ()=>{
    const hidden = historyWrap.style.display==='none';
    if(hidden){ historyPage=1; renderHistoryPage(); historyWrap.style.display='block'; toggleHistoryBtn.textContent='إخفاء سجل السحب'; }
    else { historyWrap.style.display='none'; toggleHistoryBtn.textContent='إظهار سجل السحب'; }
  });
  histPrev.addEventListener('click', ()=>{ if(historyPage>1){ historyPage--; renderHistoryPage(); } });
  histNext.addEventListener('click', ()=>{ if(historyPage<totalHistoryPages()){ historyPage++; renderHistoryPage(); } });

  // ===== Export / Import / Clear =====
  $('#exportBtn').addEventListener('click', ()=>{
    const blob=new Blob([JSON.stringify(state,null,2)], {type:'application/json;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`home-inventory-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  });

  $('#importFile').addEventListener('change', async (e)=>{
    const file=e.target.files[0]; if(!file) return;
    try{
      const text=await file.text(); const data=JSON.parse(text);
      if(!data || !Array.isArray(data.items)) throw new Error('صيغة غير صحيحة');
      data.items = data.items.map(i=>({
        id:i.id||generateId(), name:(i.name||'').toString(), category:i.category||'', location:i.location||'',
        unitType:(i.unitType==='weight')?'weight':'piece', quantity:Number(i.quantity||0),
        weightUnit:(i.unitType==='weight')?(i.weightUnit||'كجم'):null,
        threshold:(i.threshold===undefined||i.threshold===null||i.threshold==='')?null:Number(i.threshold),
        dateAdded:i.dateAdded||null,
        barcode:i.barcode||null
      }));
      const incomingCats = Array.isArray(data.categories)?data.categories:[];
      const incomingLocs = Array.isArray(data.locations)?data.locations:[];
      const rebuiltCats = dedupeCats([...DEFAULT_CATS, ...incomingCats, ...data.items.map(i=>(i.category||'').trim()).filter(Boolean)]);
      const rebuiltLocs = dedupeCats([...DEFAULT_LOCS, ...incomingLocs, ...data.items.map(i=>(i.location||'').trim()).filter(Boolean)]);
      const incomingHistory = Array.isArray(data.history)?data.history:[];
      state = { items:data.items, categories:rebuiltCats, locations:rebuiltLocs, history:incomingHistory.slice(0,500) };
      save(); toast('📥 تم الاستيراد بنجاح'); e.target.value='';
    }catch(err){ console.error(err); toast('❌ فشل الاستيراد — تأكد من الملف'); }
  });

  clearAllBtn.addEventListener('click', ()=>{
    if(confirm('سيتم تفريغ كل البيانات من هذا المتصفح. متأكد؟')){
      state = { items: [], categories: [...DEFAULT_CATS], locations: [...DEFAULT_LOCS], history: [] };
      save(); toast('♻️ تم التفريغ');
    }
  });

  // ===== Init =====
  function firstRender(){
    initSort(itemsTable, sortState, render);
    initSort(lowTable, lowSortState, renderLowList);
    loadLocalBarcodeDB();
    buildCategoryOptions('');
    buildLocationOptions('');
    ensureCustomFieldVisibility();
    ensureLocationFieldVisibility();
    quantityChangedUI();
    dateAddedInput.value = todayLocalISO(); render();
    if(!canStore) toast('⚠️ التخزين المحلي غير متاح؛ لن يتم حفظ البيانات بعد إغلاق الصفحة');
  }
  firstRender();
})();

