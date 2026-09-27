const SPREADSHEET_ID = '1z2vVKOAuIiDvYXzIcY4nl-vARVaTb_PC-EsWN294NeM';
const SHEETS = {
  employees:'NHAN_VIEN', departments:'PHONG_BAN', kpis:'DANH_MUC_KPI', roleKpis:'KPI_THEO_VI_TRI',
  assignments:'GIAO_CHI_TIEU', allocations:'PHAN_BO_KPI', sales:'DOANH_SO_NV', results:'KET_QUA_KPI',
  changes:'DIEU_CHINH_KPI', permissions:'PHAN_QUYEN', logs:'NHAT_KY_HE_THONG', config:'CAU_HINH', incomeConfig:'CAU_HINH_3P', payroll:'BANG_LUONG', performance:'THUC_HIEN_KPI'
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
    if (action === 'confirmPerformance') return json_(confirmPerformance_(email, payload.data || {}));
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
  const performance = readObjects_(SHEETS.performance).filter(r => (!period || String(r.PERIOD_ID) === String(period)) && scopePerformance_(user,r,employees));
  return {ok:true,user,period,employees,results,assignments,sales,performance};
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
  const roleKpis = readObjects_(SHEETS.roleKpis);
  const period = getConfig_('CURRENT_PERIOD', '2026-09');
  const configs = readObjects_(SHEETS.incomeConfig).filter(r => String(r['Trạng thái']||'').toUpperCase()==='ACTIVE');
  const incomeConfig = configs.find(r => String(r['Phạm vi'])==='EMPLOYEE' && String(r['Đối tượng'])===String(user.EMPLOYEE_ID)) || configs.find(r => String(r['Phạm vi'])==='DEFAULT') || null;
  const payroll = readObjects_(SHEETS.payroll).find(r => String(r.PERIOD_ID)===String(period) && String(r.EMPLOYEE_ID)===String(user.EMPLOYEE_ID)) || null;
  return {ok:true,user,employees,departments,kpis,roleKpis,incomeConfig,payroll};
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
  const assignee = readObjects_(SHEETS.employees).find(r => String(r.EMPLOYEE_ID) === String(data.assigneeId));
  if (!assignee || !scopeEmployee_(user, assignee)) throw new Error('ASSIGNEE_OUT_OF_SCOPE');
  const roleRows = readObjects_(SHEETS.roleKpis).filter(r => positionMatch_(assignee, r['Đơn vị/Vị trí']));
  const activeRows = roleRows.filter(r => String(r['Trạng thái'] || '').toUpperCase() === 'ACTIVE');
  const totalWeight = activeRows.reduce((s,r) => s + Number(r['Trọng số mặc định %'] || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.001) throw new Error('POSITION_KPI_WEIGHT_NOT_100');
  const roleKpi = activeRows.find(r => String(r['Mã KPI']) === String(data.kpiCode));
  if (!roleKpi) throw new Error('KPI_NOT_ALLOWED_FOR_POSITION');
  const masterKpi = readObjects_(SHEETS.kpis).find(r => String(r['Mã KPI']) === String(data.kpiCode)) || {};
  const defaultTarget = roleKpi['Target mặc định'];
  const defaultWeight = roleKpi['Trọng số mặc định %'];
  if (defaultTarget === '' || defaultTarget === null || defaultTarget === undefined) throw new Error('KPI_TARGET_NOT_CONFIGURED');
  if (defaultWeight === '' || defaultWeight === null || defaultWeight === undefined) throw new Error('KPI_WEIGHT_NOT_CONFIGURED');
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
    'Tên KPI':roleKpi['Tên KPI'] || masterKpi['Tên KPI'] || '',
    'Đơn vị':masterKpi['Đơn vị'] || '',
    'Chiều':masterKpi['Chiều'] || 'Tăng',
    Target:Number(defaultTarget),
    'Trọng số %':Number(defaultWeight),
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
function scopePerformance_(u, r, employees) { return u.SCOPE === 'COMPANY' || employees.some(e => String(e.EMPLOYEE_ID) === String(r.EMPLOYEE_ID)); }
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
  if (String(a['Trạng thái']) === 'DA_CHOT') throw new Error('ASSIGNMENT_CLOSED');
  const emp = readObjects_(SHEETS.employees).find(r => String(r.EMPLOYEE_ID) === String(user.EMPLOYEE_ID)) || {};
  const id = 'PERF-' + Utilities.getUuid().slice(0,8).toUpperCase();
  appendRowByHeaders_(SHEETS.performance,{RECORD_ID:id,PERIOD_ID:a.PERIOD_ID,'Ngày':data.date||today_(),EMPLOYEE_ID:user.EMPLOYEE_ID,'Nhân viên':emp['Họ tên']||user.EMPLOYEE_ID,ASSIGNMENT_ID:a.ASSIGNMENT_ID,'Mã KPI':a['Mã KPI'],'Tên KPI':a['Tên KPI'],'Giá trị thực hiện':Number(data.value||0),'Đơn vị':a['Đơn vị']||'','Minh chứng/Link':data.evidence||'','Ghi chú':data.note||'','Trạng thái':'DA_GUI','Người xác nhận':'','Thời gian xác nhận':''});
  setAssignmentStatus_(a.ASSIGNMENT_ID,'DANG_THUC_HIEN');
  upsertResult_(a,user.EMPLOYEE_ID);
  log_(user.USER_ID,'RECORD_PERFORMANCE',SHEETS.performance,id,'',JSON.stringify(data));
  return {ok:true,recordId:id};
}

function confirmPerformance_(email,data){
  const user=resolveUser_(email); if(!user) throw new Error('USER_NOT_AUTHORIZED');
  if(!['COMPANY','DEPARTMENT'].includes(String(user.SCOPE))) throw new Error('NO_CONFIRM_PERMISSION');
  const sh=ss_().getSheetByName(SHEETS.performance),v=sh.getDataRange().getValues(),h=v[0].map(String);
  const idc=h.indexOf('RECORD_ID'),ec=h.indexOf('EMPLOYEE_ID'),sc=h.indexOf('Trạng thái'),uc=h.indexOf('Người xác nhận'),tc=h.indexOf('Thời gian xác nhận'),ac=h.indexOf('ASSIGNMENT_ID');
  for(let i=1;i<v.length;i++){if(String(v[i][idc])!==String(data.recordId))continue;const emp=readObjects_(SHEETS.employees).find(e=>String(e.EMPLOYEE_ID)===String(v[i][ec]));if(!emp||!scopeEmployee_(user,emp))throw new Error('OUT_OF_SCOPE');const status=data.approved===false?'TU_CHOI':'DA_XAC_NHAN';sh.getRange(i+1,sc+1).setValue(status);if(uc>=0)sh.getRange(i+1,uc+1).setValue(user.EMPLOYEE_ID||user.USER_ID);if(tc>=0)sh.getRange(i+1,tc+1).setValue(new Date());const a=readObjects_(SHEETS.assignments).find(x=>String(x.ASSIGNMENT_ID)===String(v[i][ac]));if(a)upsertResult_(a,v[i][ec]);log_(user.USER_ID,'CONFIRM_PERFORMANCE',SHEETS.performance,data.recordId,'',status);return {ok:true,status};}
  throw new Error('PERFORMANCE_NOT_FOUND');
}

function setAssignmentStatus_(id,status){
  const sh=ss_().getSheetByName(SHEETS.assignments),v=sh.getDataRange().getValues(),h=v[0].map(String),ic=h.indexOf('ASSIGNMENT_ID'),sc=h.indexOf('Trạng thái');
  if(ic<0||sc<0)return;for(let i=1;i<v.length;i++)if(String(v[i][ic])===String(id)){sh.getRange(i+1,sc+1).setValue(status);return;}
}

function upsertResult_(a,employeeId){
  const records=readObjects_(SHEETS.performance).filter(r=>String(r.ASSIGNMENT_ID)===String(a.ASSIGNMENT_ID)&&String(r['Trạng thái'])!=='TU_CHOI');
  if(!records.length)return;
  const actual=records.reduce((s,r)=>s+Number(r['Giá trị thực hiện']||0),0),target=Number(a.Target||0),direction=String(a['Chiều']||'Tăng').toLowerCase();
  let completion=0;if(target===0)completion=actual===0?1:0;else completion=direction.includes('giảm')?target/Math.max(actual,0.0000001):actual/target;
  const score=score_(completion),weight=Number(a['Trọng số %']||0),converted=score*weight/100;
  const sh=ss_().getSheetByName(SHEETS.results),v=sh.getDataRange().getValues(),h=v[0].map(String),ac=h.indexOf('ASSIGNMENT_ID');
  const obj={PERIOD_ID:a.PERIOD_ID,ASSIGNMENT_ID:a.ASSIGNMENT_ID,EMPLOYEE_ID:employeeId,'Mã KPI':a['Mã KPI'],Target:target,'Thực hiện':actual,'% Hoàn thành':completion,'Điểm 1-5':score,'Trọng số %':weight,'Điểm quy đổi':converted,'Trạng thái dữ liệu':records.some(r=>String(r['Trạng thái'])==='DA_XAC_NHAN')?'DA_XAC_NHAN':'DA_GUI','Trạng thái chốt':'DANG_THUC_HIEN'};
  for(let i=1;i<v.length;i++)if(String(v[i][ac])===String(a.ASSIGNMENT_ID)){h.forEach((k,j)=>{if(Object.prototype.hasOwnProperty.call(obj,k))sh.getRange(i+1,j+1).setValue(obj[k])});return;}
  appendRowByHeaders_(SHEETS.results,obj);
}
function score_(completion){const x=Number(completion||0);if(x<.7)return 1;if(x<.85)return 2;if(x<.95)return 3;if(x<1)return 4;return 5;}

function positionMatch_(employee, positionName) {
  const p=String(positionName||'').toLowerCase(), dept=String(employee['Phòng ban']||'').toLowerCase(), title=String(employee['Chức danh']||'').toLowerCase();
  if (dept.includes('kinh doanh') && (title.includes('trưởng')||title.includes('manager'))) return p==='sale – trưởng phòng';
  if (dept.includes('kinh doanh')) return p==='sale – nhân viên';
  if (dept.includes('mua hàng') && title.includes('logistic')) return p==='mua hàng – logistics';
  if (dept.includes('mua hàng') && (title.includes('chứng từ')||title.includes('nhập khẩu'))) return p==='mua hàng – chứng từ nk';
  if (dept.includes('mua hàng') && title.includes('trưởng')) return p==='mua hàng – trưởng phòng';
  if (dept.includes('mua hàng')) return p==='mua hàng – nhân viên';
  if (dept.includes('kế toán') && (title.includes('trưởng')||title.includes('kế toán trưởng'))) return p==='kế toán – kế toán trưởng';
  if (dept.includes('kế toán') && title.includes('thuế')) return p==='kế toán – thuế';
  if (dept.includes('kế toán') && (title.includes('công nợ')||title.includes('kho'))) return p==='kế toán – công nợ & kho';
  if (dept.includes('kế toán') && (title.includes('thanh toán')||title.includes('ttqt'))) return p==='kế toán – thanh toán & ttqt';
  if (dept.includes('kế toán') && title.includes('thủ quỹ')) return p==='kế toán – thủ quỹ';
  if (dept.includes('ban điều hành') && (title.includes('tổng giám đốc')||title==='tgd')) return p==='ban điều hành – tgd';
  if (dept.includes('ban điều hành') && title.includes('coo')) return p==='ban điều hành – coo';
  if (dept.includes('ban điều hành') && (title.includes('chủ tịch')||title.includes('bod'))) return p==='ban điều hành – bod';
  return false;
}
