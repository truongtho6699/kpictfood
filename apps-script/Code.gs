const SPREADSHEET_ID = '1z2vVKOAuIiDvYXzIcY4nl-vARVaTb_PC-EsWN294NeM';
const SHEETS = {
  employees:'NHAN_VIEN', departments:'PHONG_BAN', kpis:'DANH_MUC_KPI', roleKpis:'KPI_THEO_VI_TRI',
  assignments:'GIAO_CHI_TIEU', allocations:'PHAN_BO_KPI', sales:'DOANH_SO_NV', results:'KET_QUA_KPI',
  changes:'DIEU_CHINH_KPI', permissions:'PHAN_QUYEN', logs:'NHAT_KY_HE_THONG', config:'CAU_HINH'
};

function doGet(e) {
  try {
    const action = (e.parameter.action || 'bootstrap').trim();
    const email = (e.parameter.email || Session.getActiveUser().getEmail() || '').toLowerCase();
    if (action === 'bootstrap') return json_(bootstrap_(email));
    if (action === 'dashboard') return json_(dashboard_(email, e.parameter.period || getConfig_('CURRENT_PERIOD', '2026-09')));
    if (action === 'masterData') return json_(masterData_(email));
    return json_({ok:false,error:'UNKNOWN_ACTION'});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = payload.action || '';
    const email = (payload.email || Session.getActiveUser().getEmail() || '').toLowerCase();
    if (action === 'createSale') return json_(createSale_(email, payload.data || {}));
    if (action === 'createAssignment') return json_(createAssignment_(email, payload.data || {}));
    if (action === 'confirmSale') return json_(confirmSale_(email, payload.data || {}));
    if (action === 'recordPerformance') return json_(recordPerformance_(email, payload.data || {}));
    return json_({ok:false,error:'UNKNOWN_ACTION'});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function bootstrap_(email) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  return {ok:true,user:user,config:configObject_()};
}

function dashboard_(email, period) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  const employees = readObjects_(SHEETS.employees).filter(r => scopeEmployee_(user, r));
  const results = readObjects_(SHEETS.results).filter(r => (!period || String(r.PERIOD_ID) === String(period)) && scopeResult_(user, r, employees));
  const assignments = readObjects_(SHEETS.assignments).filter(r => (!period || String(r.PERIOD_ID) === String(period)) && scopeAssignment_(user, r, employees));
  const sales = readObjects_(SHEETS.sales).filter(r => (!period || String(r.PERIOD_ID) === String(period)) && scopeSale_(user, r, employees));
  return {ok:true,user,period,employees,results,assignments,sales};
}

function createSale_(email, data) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  const employeeId = user.EMPLOYEE_ID;
  if (!employeeId) throw new Error('EMPLOYEE_NOT_LINKED');
  const employee = readObjects_(SHEETS.employees).find(r => String(r.EMPLOYEE_ID) === String(employeeId));
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  const now = new Date();
  const saleDate = data.date || Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const period = saleDate.slice(0,7);
  const tx = 'SALE-' + employeeId + '-' + Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
  appendRowByHeaders_(SHEETS.sales, {
    TRANSACTION_ID:tx,
    'Ngày':saleDate,
    PERIOD_ID:period,
    EMPLOYEE_ID:employeeId,
    'Nhân viên':employee['Họ tên'],
    'Khách hàng':data.customer || '',
    'Mã KH':data.customerId || '',
    'Số đơn/Chứng từ':data.documentNo || '',
    'Nội dung':data.content || 'Bán hàng',
    'Doanh số':Number(data.amount || 0),
    'Sản lượng Kg':Number(data.qty || 0),
    'Trả/Hủy':Number(data.cancelQty || 0),
    'Doanh số thuần':Number(data.amount || 0),
    'Sản lượng thuần':Number(data.qty || 0) - Number(data.cancelQty || 0),
    'Trạng thái':data.status || 'DA_GUI',
    'Người xác nhận':employee['Quản lý trực tiếp'] || '',
    'Thời gian xác nhận':'',
    'Ghi chú':data.note || ''
  });
  log_(user.USER_ID, 'CREATE_SALE', 'DOANH_SO_NV', tx, '', JSON.stringify(data));
  return {ok:true,transactionId:tx};
}

function masterData_(email) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  const employees = readObjects_(SHEETS.employees).filter(r => scopeEmployee_(user,r));
  const departments = readObjects_(SHEETS.departments);
  const kpis = readObjects_(SHEETS.kpis);
  return {ok:true,user,employees,departments,kpis};
}

function confirmSale_(email, data) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  if (!['COMPANY','DEPARTMENT'].includes(String(user.SCOPE))) throw new Error('NO_CONFIRM_PERMISSION');
  const sh = ss_().getSheetByName(SHEETS.sales);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol = headers.indexOf('TRANSACTION_ID');
  const statusCol = headers.indexOf('Trạng thái');
  const confirmerCol = headers.indexOf('Người xác nhận');
  const timeCol = headers.indexOf('Thời gian xác nhận');
  const empCol = headers.indexOf('EMPLOYEE_ID');
  const target = String(data.transactionId || '');
  for (let i=1;i<values.length;i++) {
    if (String(values[i][idCol]) !== target) continue;
    const emp = readObjects_(SHEETS.employees).find(e=>String(e.EMPLOYEE_ID)===String(values[i][empCol]));
    if (!emp || !scopeEmployee_(user,emp)) throw new Error('OUT_OF_SCOPE');
    const newStatus = data.approved === false ? 'TU_CHOI' : 'DA_XAC_NHAN';
    sh.getRange(i+1,statusCol+1).setValue(newStatus);
    if (confirmerCol>=0) sh.getRange(i+1,confirmerCol+1).setValue(user.EMPLOYEE_ID || user.USER_ID);
    if (timeCol>=0) sh.getRange(i+1,timeCol+1).setValue(new Date());
    log_(user.USER_ID,'CONFIRM_SALE',SHEETS.sales,target,String(values[i][statusCol]),newStatus);
    return {ok:true,transactionId:target,status:newStatus};
  }
  throw new Error('TRANSACTION_NOT_FOUND');
}

function createAssignment_(email, data) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  const canAssign = user['Có quyền giao KPI'] === true || String(user['Có quyền giao KPI']).toUpperCase() === 'TRUE';
  if (!canAssign) throw new Error('NO_ASSIGN_PERMISSION');
  const period = data.period || getConfig_('CURRENT_PERIOD', '2026-09');
  const id = 'ASN-' + period + '-' + Utilities.getUuid().slice(0,8).toUpperCase();
  appendRowByHeaders_(SHEETS.assignments, {
    ASSIGNMENT_ID:id,
    PARENT_ASSIGNMENT_ID:data.parentAssignmentId || '',
    PERIOD_ID:period,
    'Kỳ':data.periodLabel || period,
    'Cấp giao':user.ROLE === 'MANAGER' ? 'TRUONG_PHONG' : 'BĐH',
    ASSIGNER_ID:user.EMPLOYEE_ID || user.USER_ID,
    'Người/Đơn vị giao':data.assignerName || user.EMPLOYEE_ID || user.USER_ID,
    'Cấp nhận':data.assigneeLevel || 'NHAN_VIEN',
    ASSIGNEE_ID:data.assigneeId || '',
    'Người/Đơn vị nhận':data.assigneeName || '',
    DEPARTMENT_ID:data.departmentId || user.DEPARTMENT_ID || '',
    'Phòng ban':data.departmentName || '',
    'Mã KPI':data.kpiCode || '',
    'Tên KPI':data.kpiName || '',
    'Đơn vị':data.unit || '',
    'Chiều':data.direction || 'Tăng',
    Target:Number(data.target || 0),
    'Trọng số %':Number(data.weight || 0),
    'Ngày giao':data.assignDate || today_(),
    'Ngày hiệu lực':data.startDate || today_(),
    'Ngày hết hạn':data.endDate || '',
    'Nguồn KPI':data.source || '',
    'Quy tắc phân bổ':data.allocationRule || 'SUM_EXACT',
    'Người xác nhận dữ liệu':data.dataConfirmer || '',
    'Người phê duyệt điểm':data.approver || '',
    'Trạng thái':'DA_GIAO',
    'Ghi chú':data.note || ''
  });
  log_(user.USER_ID, 'CREATE_ASSIGNMENT', 'GIAO_CHI_TIEU', id, '', JSON.stringify(data));
  return {ok:true,assignmentId:id};
}

function resolveUser_(email) {
  if (!email) return null;
  return readObjects_(SHEETS.permissions).find(r => String(r.Email || '').toLowerCase() === email && String(r['Trạng thái'] || '').toUpperCase() === 'ACTIVE') || null;
}

function scopeEmployee_(u, r) {
  if (u.SCOPE === 'COMPANY') return true;
  if (u.SCOPE === 'DEPARTMENT') return String(r.DEPARTMENT_ID) === String(u.DEPARTMENT_ID);
  return String(r.EMPLOYEE_ID) === String(u.EMPLOYEE_ID);
}
function scopeSale_(u, r, employees) { return u.SCOPE === 'COMPANY' || employees.some(e => String(e.EMPLOYEE_ID) === String(r.EMPLOYEE_ID)); }
function scopeResult_(u, r, employees) { return u.SCOPE === 'COMPANY' || employees.some(e => String(e.EMPLOYEE_ID) === String(r.EMPLOYEE_ID)); }
function scopeAssignment_(u, r) {
  if (u.SCOPE === 'COMPANY') return true;
  if (u.SCOPE === 'DEPARTMENT') return String(r.DEPARTMENT_ID) === String(u.DEPARTMENT_ID);
  return String(r.ASSIGNEE_ID) === String(u.EMPLOYEE_ID);
}

function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function readObjects_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(x => x !== '' && x !== null)).map(r => Object.fromEntries(headers.map((k,i) => [k,r[i]])));
}
function appendRowByHeaders_(name, obj) {
  const sh = ss_().getSheetByName(name);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(k => Object.prototype.hasOwnProperty.call(obj,k) ? obj[k] : ''));
}
function getConfig_(key, def) {
  const row = readObjects_(SHEETS.config).find(r => String(r.KEY) === String(key));
  return row ? row.VALUE : def;
}
function configObject_() {
  const out = {};
  readObjects_(SHEETS.config).forEach(r => out[r.KEY] = r.VALUE);
  return out;
}
function log_(uid, action, objectName, objectId, before, after) {
  appendRowByHeaders_(SHEETS.logs, {
    LOG_ID:'LOG-' + Utilities.getUuid().slice(0,8),
    'Thời gian':new Date(),
    USER_ID:uid,
    'Hành động':action,
    'Đối tượng':objectName,
    OBJECT_ID:objectId,
    'Dữ liệu trước':before,
    'Dữ liệu sau':after,
    'IP/Thiết bị':'',
    'Ghi chú':''
  });
}
function today_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function recordPerformance_(email, data) {
  const user = resolveUser_(email);
  if (!user) throw new Error('USER_NOT_AUTHORIZED');
  const a = readObjects_(SHEETS.assignments).find(r => String(r.ASSIGNMENT_ID) === String(data.assignmentId));
  if (!a) throw new Error('ASSIGNMENT_NOT_FOUND');
  if (String(a.ASSIGNEE_ID) !== String(user.EMPLOYEE_ID)) throw new Error('OUT_OF_SCOPE');
  const emp = readObjects_(SHEETS.employees).find(r => String(r.EMPLOYEE_ID) === String(user.EMPLOYEE_ID)) || {};
  const id = 'PERF-' + Utilities.getUuid().slice(0,8).toUpperCase();
  const sh = ss_().getSheetByName('THUC_HIEN_KPI');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const obj = {RECORD_ID:id,PERIOD_ID:a.PERIOD_ID,'Ngày':today_(),EMPLOYEE_ID:user.EMPLOYEE_ID,'Nhân viên':emp['Họ tên']||user.EMPLOYEE_ID,ASSIGNMENT_ID:a.ASSIGNMENT_ID,'Mã KPI':a['Mã KPI'],'Tên KPI':a['Tên KPI'],'Giá trị thực hiện':Number(data.value||0),'Đơn vị':a['Đơn vị']||'','Minh chứng/Link':data.evidence||'','Ghi chú':data.note||'','Trạng thái':'DA_GUI'};
  sh.appendRow(headers.map(k => Object.prototype.hasOwnProperty.call(obj,k) ? obj[k] : ''));
  return {ok:true,recordId:id};
}
