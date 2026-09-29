const SPREADSHEET_ID = '1z2vVKOAuIiDvYXzIcY4nl-vARVaTb_PC-EsWN294NeM';
const SHEETS = {
  employees:'NHAN_VIEN', departments:'PHONG_BAN', kpis:'DANH_MUC_KPI', roleKpis:'KPI_THEO_VI_TRI',
  assignments:'GIAO_CHI_TIEU', allocations:'PHAN_BO_KPI', sales:'DOANH_SO_NV', results:'KET_QUA_KPI',
  changes:'DIEU_CHINH_KPI', permissions:'PHAN_QUYEN', logs:'NHAT_KY_HE_THONG', config:'CAU_HINH', incomeConfig:'CAU_HINH_3P', payroll:'BANG_LUONG', performance:'THUC_HIEN_KPI', accounts:'TAI_KHOAN', sessions:'PHIEN_DANG_NHAP', conflicts:'DOI_SOAT_DU_LIEU'
};

function doGet(e) {
  try {
    const action = (e.parameter.action || 'bootstrap').trim();
    const email = authenticate_(e.parameter.token || '');
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
    if (action === 'login') return json_(login_(payload.data || {}));
    if (action === 'logout') return json_(logout_(payload.token || ''));
    const email = authenticate_(payload.token || '');
    if (action === 'createSale') return json_(createSale_(email, payload.data || {}));
    if (action === 'createAssignment') return json_(createAssignment_(email, payload.data || {}));
    if (action === 'createPositionAssignments') return json_(createPositionAssignments_(email, payload.data || {}));
    if (action === 'confirmSale') return json_(confirmSale_(email, payload.data || {}));
    if (action === 'recordPerformance') return json_(recordPerformance_(email, payload.data || {}));
    if (action === 'confirmPerformance') return json_(confirmPerformance_(email, payload.data || {}));
    if (action === 'acceptAssignment') return json_(acceptAssignment_(email, payload.data || {}));
    if (action === 'allocateAssignment') return json_(allocateAssignment_(email, payload.data || {}));
    if (action === 'closeAssignment') return json_(closeAssignment_(email, payload.data || {}));
    if (action === 'adminSetPassword') return json_(adminSetPassword_(email, payload.data || {}));
    if (action === 'adminUpsertEmployee') return json_(adminUpsertEmployee_(email, payload.data || {}));
    if (action === 'adminUpsert3P') return json_(adminUpsert3P_(email, payload.data || {}));
    if (action === 'adminUpsertPayroll') return json_(adminUpsertPayroll_(email, payload.data || {}));
    if (action === 'adminClosePayrollPeriod') return json_(adminClosePayrollPeriod_(email, payload.data || {}));
    if (action === 'calculatePayroll') return json_(calculatePayroll_(email, payload.data || {}));
    if (action === 'adminSetCurrentPeriod') return json_(adminSetCurrentPeriod_(email, payload.data || {}));
    if (action === 'adminUpsertKpi') return json_(adminUpsertKpi_(email, payload.data || {}));
    if (action === 'adminUpsertRoleKpi') return json_(adminUpsertRoleKpi_(email, payload.data || {}));
    if (action === 'adminResolveConflict') return json_(adminResolveConflict_(email, payload.data || {}));
    return json_({ok:false,error:'UNKNOWN_ACTION'});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  }
}

function login_(data){
  const email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
  if(!email||!password)throw new Error('EMAIL_PASSWORD_REQUIRED');
  const account=readObjects_(SHEETS.accounts).find(r=>String(r.EMAIL||'').toLowerCase()===email);
  if(!account||String(account.STATUS||'').toUpperCase()!=='ACTIVE')throw new Error('LOGIN_INVALID');
  if(account.LOCK_UNTIL&&new Date(account.LOCK_UNTIL)>new Date())throw new Error('ACCOUNT_LOCKED');
  const expected=hashPassword_(password,String(account.SALT||''));if(expected!==String(account.PASSWORD_HASH||'')){updateAccountLogin_(email,false);throw new Error('LOGIN_INVALID');}
  if(!resolveUser_(email))throw new Error('USER_NOT_AUTHORIZED');
  updateAccountLogin_(email,true);
  const token=Utilities.getUuid()+Utilities.getUuid(),now=new Date(),expires=new Date(now.getTime()+12*60*60*1000);
  appendRowByHeaders_(SHEETS.sessions,{TOKEN_HASH:hashToken_(token),EMAIL:email,CREATED_AT:now,EXPIRES_AT:expires,REVOKED:false,USER_AGENT:'',LAST_USED_AT:now});
  return {ok:true,token,expiresAt:expires,user:resolveUser_(email)};
}
function logout_(token){if(!token)return {ok:true};const sh=ss_().getSheetByName(SHEETS.sessions),v=sh.getDataRange().getValues(),h=v[0].map(String),tc=h.indexOf('TOKEN_HASH'),rc=h.indexOf('REVOKED');const x=hashToken_(token);for(let i=1;i<v.length;i++)if(String(v[i][tc])===x){sh.getRange(i+1,rc+1).setValue(true);break;}return {ok:true};}
function authenticate_(token){if(!token)throw new Error('AUTH_REQUIRED');const x=hashToken_(token),s=readObjects_(SHEETS.sessions).find(r=>String(r.TOKEN_HASH)===x&&String(r.REVOKED).toUpperCase()!=='TRUE'&&new Date(r.EXPIRES_AT)>new Date());if(!s)throw new Error('SESSION_EXPIRED');return String(s.EMAIL||'').toLowerCase();}
function hashPassword_(password,salt){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password+'|'+salt,Utilities.Charset.UTF_8));}
function hashToken_(token){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,token,Utilities.Charset.UTF_8));}
function updateAccountLogin_(email,ok){const sh=ss_().getSheetByName(SHEETS.accounts),v=sh.getDataRange().getValues(),h=v[0].map(String),ec=h.indexOf('EMAIL'),fc=h.indexOf('FAILED_ATTEMPTS'),lc=h.indexOf('LOCK_UNTIL'),last=h.indexOf('LAST_LOGIN');for(let i=1;i<v.length;i++)if(String(v[i][ec]).toLowerCase()===email){if(ok){sh.getRange(i+1,fc+1).setValue(0);if(lc>=0)sh.getRange(i+1,lc+1).clearContent();if(last>=0)sh.getRange(i+1,last+1).setValue(new Date());}else{const n=Number(v[i][fc]||0)+1;sh.getRange(i+1,fc+1).setValue(n);if(n>=5&&lc>=0)sh.getRange(i+1,lc+1).setValue(new Date(Date.now()+15*60*1000));}return;}}
function setInitialPassword_(email,password){const u=resolveUser_(String(email||'').toLowerCase());if(!u)throw new Error('USER_NOT_AUTHORIZED');if(String(password||'').length<8)throw new Error('PASSWORD_TOO_SHORT');const existing=readObjects_(SHEETS.accounts).find(r=>String(r.EMAIL||'').toLowerCase()===String(email).toLowerCase());if(existing)throw new Error('ACCOUNT_ALREADY_EXISTS');const salt=Utilities.getUuid();appendRowByHeaders_(SHEETS.accounts,{EMAIL:String(email).toLowerCase(),PASSWORD_HASH:hashPassword_(password,salt),SALT:salt,STATUS:'ACTIVE',FAILED_ATTEMPTS:0,LOCK_UNTIL:'',LAST_LOGIN:'',PASSWORD_UPDATED_AT:new Date()});return true;}

function adminSetPassword_(actorEmail,data){
  const actor=resolveUser_(actorEmail);if(!actor||!['EXECUTIVE','BOARD','ADMIN'].includes(String(actor.ROLE)))throw new Error('NO_ADMIN_PERMISSION');
  const email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
  if(!resolveUser_(email))throw new Error('USER_NOT_AUTHORIZED');if(password.length<8)throw new Error('PASSWORD_TOO_SHORT');
  const sh=ss_().getSheetByName(SHEETS.accounts),v=sh.getDataRange().getValues(),h=v[0].map(String),ec=h.indexOf('EMAIL'),hc=h.indexOf('PASSWORD_HASH'),sc=h.indexOf('SALT'),st=h.indexOf('STATUS'),fc=h.indexOf('FAILED_ATTEMPTS'),lc=h.indexOf('LOCK_UNTIL'),pc=h.indexOf('PASSWORD_UPDATED_AT'),salt=Utilities.getUuid(),hash=hashPassword_(password,salt);
  let found=false;for(let i=1;i<v.length;i++)if(String(v[i][ec]).toLowerCase()===email){found=true;sh.getRange(i+1,hc+1).setValue(hash);sh.getRange(i+1,sc+1).setValue(salt);sh.getRange(i+1,st+1).setValue('ACTIVE');sh.getRange(i+1,fc+1).setValue(0);if(lc>=0)sh.getRange(i+1,lc+1).clearContent();if(pc>=0)sh.getRange(i+1,pc+1).setValue(new Date());break;}
  if(!found)appendRowByHeaders_(SHEETS.accounts,{EMAIL:email,PASSWORD_HASH:hash,SALT:salt,STATUS:'ACTIVE',FAILED_ATTEMPTS:0,LOCK_UNTIL:'',LAST_LOGIN:'',PASSWORD_UPDATED_AT:new Date()});
  revokeSessions_(email);log_(actor.USER_ID,'ADMIN_SET_PASSWORD',SHEETS.accounts,email,'','PASSWORD_RESET');return {ok:true,email};
}
function requireAdmin_(email){const u=resolveUser_(email);if(!u||!['EXECUTIVE','BOARD','ADMIN'].includes(String(u.ROLE)))throw new Error('NO_ADMIN_PERMISSION');return u;}
function adminResolveConflict_(email,data){const u=requireAdmin_(email),id=String(data.issueId||'').trim(),decision=String(data.decision||'').trim(),status=String(data.status||'DA_XU_LY').trim();if(!id||!decision)throw new Error('CONFLICT_DECISION_REQUIRED');const sh=ss_().getSheetByName(SHEETS.conflicts),v=sh.getDataRange().getValues(),h=v[0].map(String),ic=h.indexOf('ISSUE_ID'),sc=h.indexOf('Trạng thái'),dc=h.indexOf('Quyết định'),gc=h.indexOf('Ghi chú');for(let i=1;i<v.length;i++)if(String(v[i][ic])===id){sh.getRange(i+1,sc+1).setValue(status);sh.getRange(i+1,dc+1).setValue(decision);if(gc>=0&&data.note)sh.getRange(i+1,gc+1).setValue(String(data.note));log_(u.USER_ID,'RESOLVE_DATA_CONFLICT',SHEETS.conflicts,id,'',JSON.stringify({decision,status}));return {ok:true,issueId:id,status};}throw new Error('CONFLICT_NOT_FOUND');}
function adminUpsertKpi_(email,data){const u=requireAdmin_(email),code=String(data.code||'').trim();if(!code)throw new Error('KPI_CODE_REQUIRED');const obj={'Mã KPI':code,'Nhóm KPI':String(data.group||''),'Tên KPI':String(data.name||''),'Đơn vị':String(data.unit||''),'Chiều':String(data.direction||'Tăng'),'Target tham chiếu':data.targetReference===undefined?'':data.targetReference,'Nguồn dữ liệu':String(data.source||''),'Trạng thái Target':String(data.targetStatus||'ACTIVE')};if(!obj['Tên KPI'])throw new Error('KPI_NAME_REQUIRED');upsertByKey_(SHEETS.kpis,'Mã KPI',code,obj);log_(u.USER_ID,'ADMIN_UPSERT_KPI',SHEETS.kpis,code,'',JSON.stringify(obj));return {ok:true,code};}
function adminUpsertRoleKpi_(email,data){const u=requireAdmin_(email),position=String(data.position||'').trim(),code=String(data.code||'').trim(),weight=Number(data.weight);if(!position||!code)throw new Error('POSITION_KPI_REQUIRED');if(!Number.isFinite(weight)||weight<0||weight>100)throw new Error('WEIGHT_INVALID');const kpi=readObjects_(SHEETS.kpis).find(x=>String(x['Mã KPI'])===code);if(!kpi)throw new Error('KPI_NOT_FOUND');const obj={'Đơn vị/Vị trí':position,'Mã KPI':code,'Tên KPI':kpi['Tên KPI'],'Trọng số mặc định %':weight,'Target mặc định':data.target===undefined?'':data.target,'Trạng thái':String(data.status||'ACTIVE')};upsertComposite_(SHEETS.roleKpis,['Đơn vị/Vị trí','Mã KPI'],[position,code],obj);const rows=readObjects_(SHEETS.roleKpis).filter(x=>String(x['Đơn vị/Vị trí'])===position&&String(x['Trạng thái']).toUpperCase()==='ACTIVE');const total=rows.reduce((s,x)=>s+Number(x['Trọng số mặc định %']||0),0);log_(u.USER_ID,'ADMIN_UPSERT_ROLE_KPI',SHEETS.roleKpis,position+'|'+code,'',JSON.stringify({weight,target:data.target,total}));return {ok:true,totalWeight:total,valid:Math.abs(total-100)<.001};}
function adminUpsert3P_(email,data){const u=requireAdmin_(email),id=String(data.configId||('3P-'+Utilities.getUuid().slice(0,8))).trim(),p1=Number(data.p1),p2=Number(data.p2),p3=Number(data.p3);if([p1,p2,p3].some(x=>!Number.isFinite(x)||x<0))throw new Error('PERCENT_INVALID');if(Math.abs(p1+p2+p3-1)>.0001)throw new Error('PERCENT_TOTAL_NOT_100');const obj={CONFIG_ID:id,'Phạm vi':String(data.scope||'DEFAULT'),'Đối tượng':String(data.subject||'Tất cả'),'Tỷ lệ 1P':p1,'Tỷ lệ 2P':p2,'Tỷ lệ 3P':p3,'Quy tắc 1P':String(data.rule1||''),'Quy tắc 2P':String(data.rule2||''),'Quy tắc 3P':String(data.rule3||''),'Hiệu lực từ':String(data.effectiveFrom||today_()),'Trạng thái':String(data.status||'ACTIVE')};upsertByKey_(SHEETS.incomeConfig,'CONFIG_ID',id,obj);log_(u.USER_ID,'ADMIN_UPSERT_3P',SHEETS.incomeConfig,id,'',JSON.stringify(obj));return {ok:true,configId:id};}
function calculatePayroll_(email,data){const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');const period=String(data.period||getConfig_('CURRENT_PERIOD','2026-09')),empId=String(data.employeeId||user.EMPLOYEE_ID);if(empId!==String(user.EMPLOYEE_ID)&&!['ADMIN','BOARD','EXECUTIVE'].includes(String(user.ROLE)))throw new Error('OUT_OF_SCOPE');const pay=readObjects_(SHEETS.payroll).find(x=>String(x.PERIOD_ID)===period&&String(x.EMPLOYEE_ID)===empId);if(!pay)throw new Error('PAYROLL_TARGET_NOT_CONFIGURED');const cfgs=readObjects_(SHEETS.incomeConfig).filter(x=>String(x['Trạng thái']).toUpperCase()==='ACTIVE'),emp=readObjects_(SHEETS.employees).find(x=>String(x.EMPLOYEE_ID)===empId)||{},cfg=cfgs.find(x=>String(x['Phạm vi'])==='EMPLOYEE'&&String(x['Đối tượng'])===empId)||cfgs.find(x=>String(x['Phạm vi'])==='POSITION'&&String(x['Đối tượng'])===String(emp['Chức danh']))||cfgs.find(x=>String(x['Phạm vi'])==='DEFAULT');if(!cfg)throw new Error('3P_CONFIG_NOT_FOUND');const results=readObjects_(SHEETS.results).filter(x=>String(x.PERIOD_ID)===period&&String(x.EMPLOYEE_ID)===empId&&x['Điểm quy đổi']!==''),score=results.reduce((s,x)=>s+Number(x['Điểm quy đổi']||0),0),target=Number(pay['Lương KPI mục tiêu']||0),p1=Number(cfg['Tỷ lệ 1P']||0),p2=Number(cfg['Tỷ lệ 2P']||0),p3=Number(cfg['Tỷ lệ 3P']||0);const p2Amount=target*p2*Math.min(Math.max(score/5,0),1);return {ok:true,period,employeeId:empId,targetIncome:target,kpiScore:score,p1Potential:target*p1,p2Estimated:p2Amount,p3Potential:target*p3,totalEstimated:null,status:'DU_KIEN_CHUA_DU_QUY_TAC',note:'1P và 3P chưa tự tính khi chưa có quy tắc định lượng được phê duyệt.'};}
function adminUpsertPayroll_(email,data){const u=requireAdmin_(email),period=String(data.period||getConfig_('CURRENT_PERIOD','2026-09')),empId=String(data.employeeId||''),emp=readObjects_(SHEETS.employees).find(x=>String(x.EMPLOYEE_ID)===empId);if(!emp)throw new Error('EMPLOYEE_NOT_FOUND');const current=readObjects_(SHEETS.payroll).find(x=>String(x.PERIOD_ID)===period&&String(x.EMPLOYEE_ID)===empId);if(current&&String(current['Trạng thái'])==='DA_CHOT')throw new Error('PAYROLL_PERIOD_LOCKED');const target=Number(data.targetIncome);if(!Number.isFinite(target)||target<0)throw new Error('TARGET_INCOME_INVALID');const obj={PERIOD_ID:period,EMPLOYEE_ID:empId,'Nhân viên':emp['Họ tên'],'Lương KPI mục tiêu':target,'1P dự tính':Number(data.p1Amount||0),'2P dự tính':Number(data.p2Amount||0),'3P dự tính':Number(data.p3Amount||0),'Tổng dự tính':Number(data.totalAmount||0),'Trạng thái':'NHAP','Ngày chốt':'','Ghi chú':String(data.note||'')};upsertComposite_(SHEETS.payroll,['PERIOD_ID','EMPLOYEE_ID'],[period,empId],obj);log_(u.USER_ID,'ADMIN_UPSERT_PAYROLL',SHEETS.payroll,period+'|'+empId,'',JSON.stringify(obj));return {ok:true};}
function adminClosePayrollPeriod_(email,data){const u=requireAdmin_(email),period=String(data.period||getConfig_('CURRENT_PERIOD','2026-09')),sh=ss_().getSheetByName(SHEETS.payroll),v=sh.getDataRange().getValues(),h=v[0].map(String),pc=h.indexOf('PERIOD_ID'),sc=h.indexOf('Trạng thái'),dc=h.indexOf('Ngày chốt');let n=0;for(let i=1;i<v.length;i++)if(String(v[i][pc])===period){sh.getRange(i+1,sc+1).setValue('DA_CHOT');if(dc>=0)sh.getRange(i+1,dc+1).setValue(new Date());n++;}log_(u.USER_ID,'ADMIN_CLOSE_PAYROLL_PERIOD',SHEETS.payroll,period,'',String(n));return {ok:true,closed:n};}
function adminSetCurrentPeriod_(email,data){const u=requireAdmin_(email),period=String(data.period||'').trim();if(!/^\\d{4}-\\d{2}$/.test(period))throw new Error('PERIOD_INVALID');upsertByKey_(SHEETS.config,'KEY','CURRENT_PERIOD',{KEY:'CURRENT_PERIOD',VALUE:period,'Mô tả':'Kỳ KPI hiện tại'});log_(u.USER_ID,'ADMIN_SET_CURRENT_PERIOD',SHEETS.config,'CURRENT_PERIOD','',period);return {ok:true,period:period};}
function adminUpsertEmployee_(actorEmail,data){
  const actor=resolveUser_(actorEmail);if(!actor||!['EXECUTIVE','BOARD','ADMIN'].includes(String(actor.ROLE)))throw new Error('NO_ADMIN_PERMISSION');
  const id=String(data.employeeId||'').trim(),name=String(data.name||'').trim(),email=String(data.email||'').trim().toLowerCase(),depId=String(data.departmentId||'').trim(),title=String(data.title||'').trim(),managerId=String(data.managerId||'').trim(),role=String(data.role||'EMPLOYEE').trim().toUpperCase(),status=String(data.status||'ACTIVE').trim().toUpperCase();
  if(!id||!name||!depId||!title)throw new Error('EMPLOYEE_REQUIRED_FIELDS');
  if(email&&!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email))throw new Error('EMAIL_INVALID');
  const allowed=['ADMIN','BOARD','EXECUTIVE','MANAGER','EMPLOYEE'];if(!allowed.includes(role))throw new Error('ROLE_INVALID');
  const emps=readObjects_(SHEETS.employees),existing=emps.find(x=>String(x.EMPLOYEE_ID)===id),dup=email&&emps.find(x=>String(x.Email||'').toLowerCase()===email&&String(x.EMPLOYEE_ID)!==id);if(dup)throw new Error('EMAIL_ALREADY_USED');
  const manager=managerId?emps.find(x=>String(x.EMPLOYEE_ID)===managerId):null,dep=readObjects_(SHEETS.departments).find(x=>String(x.DEPARTMENT_ID)===depId);
  const row={EMPLOYEE_ID:id,'Họ tên':name,Email:email,DEPARTMENT_ID:depId,'Phòng ban':dep?String(dep['Tên phòng ban']||dep['Phòng ban']||''):String(data.departmentName||''),'Chức danh':title,MANAGER_ID:managerId,'Quản lý trực tiếp':manager?String(manager['Họ tên']||''):'','Ngày vào làm':String(data.startDate||''),'Ngày nghỉ':'',STATUS:status,ROLE:role};
  upsertByKey_(SHEETS.employees,'EMPLOYEE_ID',id,row);
  const oldEmail=existing?String(existing.Email||'').toLowerCase():'';
  if(email){
    const scope=role==='EMPLOYEE'?'SELF':role==='MANAGER'?'DEPARTMENT':'COMPANY',canAssign=role==='MANAGER'||role==='EXECUTIVE'||role==='BOARD'||role==='ADMIN',canClose=role==='EXECUTIVE'||role==='BOARD'||role==='ADMIN';
    upsertByKey_(SHEETS.permissions,'EMPLOYEE_ID',id,{USER_ID:'U-'+id,Email:email,EMPLOYEE_ID:id,ROLE:role,SCOPE:scope,DEPARTMENT_ID:depId,'Có quyền giao KPI':canAssign,'Có quyền chốt KPI':canClose,'Trạng thái':status});
    if(oldEmail&&oldEmail!==email){revokeSessions_(oldEmail);const ash=ss_().getSheetByName(SHEETS.accounts),av=ash.getDataRange().getValues(),ah=av[0].map(String),ec=ah.indexOf('EMAIL');for(let i=1;i<av.length;i++)if(String(av[i][ec]).toLowerCase()===oldEmail){ash.getRange(i+1,ec+1).setValue(email);break;}}
  }
  log_(actor.USER_ID,'ADMIN_UPSERT_EMPLOYEE',SHEETS.employees,id,'',JSON.stringify({email:email,departmentId:depId,title:title,role:role,status:status}));return {ok:true,employeeId:id,email:email};
}
function upsertByKey_(sheetName,key,keyValue,obj){const sh=ss_().getSheetByName(sheetName),v=sh.getDataRange().getValues(),h=v[0].map(String),kc=h.indexOf(key);if(kc<0)throw new Error('KEY_COLUMN_NOT_FOUND');let row=0;for(let i=1;i<v.length;i++)if(String(v[i][kc])===String(keyValue)){row=i+1;break;}if(!row){sh.appendRow(h.map(x=>obj[x]===undefined?'':obj[x]));return;}h.forEach((x,j)=>{if(obj[x]!==undefined)sh.getRange(row,j+1).setValue(obj[x])});}
function revokeSessions_(email){const sh=ss_().getSheetByName(SHEETS.sessions),v=sh.getDataRange().getValues();if(v.length<2)return;const h=v[0].map(String),ec=h.indexOf('EMAIL'),rc=h.indexOf('REVOKED');for(let i=1;i<v.length;i++)if(String(v[i][ec]).toLowerCase()===String(email).toLowerCase()&&rc>=0)sh.getRange(i+1,rc+1).setValue(true);}
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
  const allocations = readObjects_(SHEETS.allocations).filter(r => (!period || String(r.PERIOD_ID) === String(period)) && (user.SCOPE==='COMPANY' || employees.some(e=>String(e.EMPLOYEE_ID)===String(r.EMPLOYEE_ID))));
  return {ok:true,user,period,employees,results,assignments,sales,performance,allocations};
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
  const positions = readObjects_(SHEETS.positions);
  const permissions = ['ADMIN','BOARD','EXECUTIVE'].includes(String(user.ROLE)) ? readObjects_(SHEETS.permissions) : [];
  const period = getConfig_('CURRENT_PERIOD', '2026-09');
  const configs = readObjects_(SHEETS.incomeConfig).filter(r => String(r['Trạng thái']||'').toUpperCase()==='ACTIVE');
  const incomeConfig = configs.find(r => String(r['Phạm vi'])==='EMPLOYEE' && String(r['Đối tượng'])===String(user.EMPLOYEE_ID)) || configs.find(r => String(r['Phạm vi'])==='DEFAULT') || null;
  const allPayroll = readObjects_(SHEETS.payroll), payroll = allPayroll.find(r => String(r.PERIOD_ID)===String(period) && String(r.EMPLOYEE_ID)===String(user.EMPLOYEE_ID)) || null;
  const adminData=['ADMIN','BOARD','EXECUTIVE'].includes(String(user.ROLE));
  const conflicts=adminData?readObjects_(SHEETS.conflicts):[];
  const allocations=readObjects_(SHEETS.allocations).filter(r=>{const emp=readObjects_(SHEETS.employees).find(e=>String(e.EMPLOYEE_ID)===String(r.EMPLOYEE_ID));return emp&&scopeEmployee_(user,emp)});
  return {ok:true,user,employees,departments,kpis,roleKpis,positions,permissions,incomeConfig,payroll,incomeConfigs:adminData?configs:[],payrollRows:adminData?allPayroll:[],allocations,conflicts,logs:adminData?readObjects_(SHEETS.logs).slice(-200).reverse():[],config:configObject_()};
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

function createPositionAssignments_(email,data){
  const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');
  const canAssign=user['Có quyền giao KPI']===true||String(user['Có quyền giao KPI']).toUpperCase()==='TRUE';if(!canAssign)throw new Error('NO_ASSIGN_PERMISSION');
  const period=String(data.period||getConfig_('CURRENT_PERIOD','2026-09')),assignee=readObjects_(SHEETS.employees).find(r=>String(r.EMPLOYEE_ID)===String(data.assigneeId));
  if(!assignee||!scopeEmployee_(user,assignee))throw new Error('ASSIGNEE_OUT_OF_SCOPE');
  const rows=readObjects_(SHEETS.roleKpis).filter(r=>positionMatch_(assignee,r['Đơn vị/Vị trí'])&&String(r['Trạng thái']||'').toUpperCase()==='ACTIVE');
  if(!rows.length)throw new Error('POSITION_KPI_NOT_CONFIGURED');
  const total=rows.reduce((s,r)=>s+Number(r['Trọng số mặc định %']||0),0);if(Math.abs(total-100)>.001)throw new Error('POSITION_KPI_WEIGHT_NOT_100');
  const bad=rows.filter(r=>r['Target mặc định']===''||r['Target mặc định']===null||r['Target mặc định']===undefined||r['Trọng số mặc định %']===''||r['Trọng số mặc định %']===null||r['Trọng số mặc định %']===undefined);
  if(bad.length)throw new Error('POSITION_KPI_INCOMPLETE:'+bad.map(r=>r['Mã KPI']).join(','));
  const existing=readObjects_(SHEETS.assignments).filter(r=>String(r.PERIOD_ID)===period&&String(r.ASSIGNEE_ID)===String(assignee.EMPLOYEE_ID));
  const created=[],skipped=[];
  rows.forEach(r=>{const code=String(r['Mã KPI']);if(existing.some(x=>String(x['Mã KPI'])===code)){skipped.push(code);return;}const out=createAssignment_(email,{period:period,assigneeId:assignee.EMPLOYEE_ID,assigneeName:assignee['Họ tên'],assigneeLevel:'NHAN_VIEN',departmentId:assignee.DEPARTMENT_ID,departmentName:assignee['Phòng ban'],kpiCode:code,source:'KPI_THEO_VI_TRI',allocationRule:data.allocationRule||'SUM_EXACT',dataConfirmer:data.dataConfirmer||'',approver:data.approver||'',startDate:data.startDate||today_(),endDate:data.endDate||'',note:data.note||'Tự động giao theo chức danh'});created.push({code:code,id:out.assignmentId});});
  log_(user.USER_ID,'CREATE_POSITION_ASSIGNMENTS',SHEETS.assignments,assignee.EMPLOYEE_ID,'',JSON.stringify({period:period,created:created.map(x=>x.code),skipped:skipped}));return {ok:true,created:created,skipped:skipped,totalWeight:total};
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

function acceptAssignment_(email,data){
  const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');
  const a=readObjects_(SHEETS.assignments).find(r=>String(r.ASSIGNMENT_ID)===String(data.assignmentId));if(!a)throw new Error('ASSIGNMENT_NOT_FOUND');
  if(String(a.ASSIGNEE_ID)!==String(user.EMPLOYEE_ID))throw new Error('OUT_OF_SCOPE');
  const st=String(a['Trạng thái']||'');if(!['DA_GIAO','DA_NHAN'].includes(st))throw new Error('ASSIGNMENT_STATUS_INVALID');
  setAssignmentStatus_(a.ASSIGNMENT_ID,'DA_NHAN');log_(user.USER_ID,'ACCEPT_ASSIGNMENT',SHEETS.assignments,a.ASSIGNMENT_ID,st,'DA_NHAN');return {ok:true,status:'DA_NHAN'};
}
function allocateAssignment_(email,data){
  const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');
  const parent=readObjects_(SHEETS.assignments).find(r=>String(r.ASSIGNMENT_ID)===String(data.parentAssignmentId));if(!parent)throw new Error('PARENT_ASSIGNMENT_NOT_FOUND');
  if(String(parent.ASSIGNEE_ID)!==String(user.EMPLOYEE_ID)&&String(user.SCOPE)!=='COMPANY')throw new Error('OUT_OF_SCOPE');
  if(String(parent['Trạng thái'])==='DA_CHOT')throw new Error('PARENT_ASSIGNMENT_CLOSED');
  if(parent.Target===''||parent.Target===null||parent.Target===undefined)throw new Error('PARENT_TARGET_PENDING');
  const emp=readObjects_(SHEETS.employees).find(r=>String(r.EMPLOYEE_ID)===String(data.employeeId));if(!emp||!scopeEmployee_(user,emp))throw new Error('EMPLOYEE_OUT_OF_SCOPE');
  const target=Number(data.target),weight=Number(data.weight===undefined?parent['Trọng số %']:data.weight);if(!Number.isFinite(target)||target<0)throw new Error('TARGET_INVALID');if(!Number.isFinite(weight)||weight<0)throw new Error('WEIGHT_INVALID');
  const rule=String(parent['Quy tắc phân bổ']||getConfig_('DEFAULT_ALLOC_RULE','SUM_EXACT')).toUpperCase(),existing=readObjects_(SHEETS.allocations).filter(r=>String(r.PARENT_ASSIGNMENT_ID)===String(parent.ASSIGNMENT_ID)&&String(r.EMPLOYEE_ID)!==String(emp.EMPLOYEE_ID));
  const sum=existing.reduce((s,r)=>s+Number(r['Target NV']||0),0)+target,parentTarget=Number(parent.Target||0);
  if(rule==='SUM_EXACT'&&sum>parentTarget+1e-9)throw new Error('ALLOCATION_EXCEEDS_PARENT');
  if(rule==='SUM_BELOW'&&sum>parentTarget+1e-9)throw new Error('ALLOCATION_MUST_NOT_EXCEED');
  const status=(rule==='SUM_EXACT'&&Math.abs(sum-parentTarget)<=1e-9)||rule==='NO_VALIDATION'||rule==='SUM_EXCEED'||(rule==='SUM_BELOW'&&sum<=parentTarget)?'HOP_LE':'CHUA_DU';
  const obj={PARENT_ASSIGNMENT_ID:parent.ASSIGNMENT_ID,PERIOD_ID:parent.PERIOD_ID,'Phòng ban':parent['Phòng ban'],'Mã KPI':parent['Mã KPI'],'Tên KPI':parent['Tên KPI'],'Target phòng':parentTarget,EMPLOYEE_ID:emp.EMPLOYEE_ID,'Nhân viên':emp['Họ tên'],'Target NV':target,'Trọng số %':weight,'Tổng đã phân':sum,'Còn lại':parentTarget-sum,'Kiểm tra':status,'Trạng thái':'DA_PHAN_BO'};
  upsertComposite_(SHEETS.allocations,['PARENT_ASSIGNMENT_ID','EMPLOYEE_ID'],[parent.ASSIGNMENT_ID,emp.EMPLOYEE_ID],obj);
  const childId='ASN-'+parent.PERIOD_ID+'-'+emp.EMPLOYEE_ID+'-'+String(parent['Mã KPI']).replace(/[^A-Za-z0-9-]/g,'');
  const child={ASSIGNMENT_ID:childId,PARENT_ASSIGNMENT_ID:parent.ASSIGNMENT_ID,PERIOD_ID:parent.PERIOD_ID,'Cấp giao':'NHAN_VIEN',ASSIGNER_ID:user.EMPLOYEE_ID||user.USER_ID,'Người giao':user.EMPLOYEE_ID||user.USER_ID,ASSIGNEE_ID:emp.EMPLOYEE_ID,'Người/Đơn vị nhận':emp['Họ tên'],DEPARTMENT_ID:emp.DEPARTMENT_ID,'Phòng ban':emp['Phòng ban'],'Mã KPI':parent['Mã KPI'],'Tên KPI':parent['Tên KPI'],'Nguồn KPI':'PHAN_BO_KPI',Target:target,'Đơn vị':parent['Đơn vị'],'Trọng số %':weight,'Chiều':parent['Chiều'],'Quy tắc phân bổ':rule,'Trạng thái':'DA_GIAO','Người xác nhận dữ liệu':parent['Người xác nhận dữ liệu'],'Người phê duyệt':parent['Người phê duyệt'],'Ngày bắt đầu':parent['Ngày bắt đầu'],'Ngày kết thúc':parent['Ngày kết thúc'],'Ghi chú':'Tự động tạo từ phân bổ '+parent.ASSIGNMENT_ID};
  upsertByKey_(SHEETS.assignments,'ASSIGNMENT_ID',childId,child);
  setAssignmentStatus_(parent.ASSIGNMENT_ID,'DA_PHAN_BO');log_(user.USER_ID,'ALLOCATE_ASSIGNMENT',SHEETS.allocations,parent.ASSIGNMENT_ID,'',JSON.stringify({allocation:obj,childAssignmentId:childId}));return {ok:true,status:'DA_PHAN_BO',sum:sum,remaining:parentTarget-sum,validation:status,childAssignmentId:childId};
}
function closeAssignment_(email,data){
  const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');const canClose=user['Có quyền chốt KPI']===true||String(user['Có quyền chốt KPI']).toUpperCase()==='TRUE';if(!canClose)throw new Error('NO_CLOSE_PERMISSION');
  const a=readObjects_(SHEETS.assignments).find(r=>String(r.ASSIGNMENT_ID)===String(data.assignmentId));if(!a||!scopeAssignment_(user,a))throw new Error('ASSIGNMENT_NOT_FOUND_OR_SCOPE');
  const res=readObjects_(SHEETS.results).find(r=>String(r.ASSIGNMENT_ID)===String(a.ASSIGNMENT_ID));if(!res)throw new Error('RESULT_NOT_FOUND');if(String(res['Trạng thái dữ liệu'])!=='DA_XAC_NHAN')throw new Error('RESULT_NOT_CONFIRMED');
  setAssignmentStatus_(a.ASSIGNMENT_ID,'DA_CHOT');upsertByKey_(SHEETS.results,'ASSIGNMENT_ID',a.ASSIGNMENT_ID,{'Trạng thái chốt':'DA_CHOT'});log_(user.USER_ID,'CLOSE_ASSIGNMENT',SHEETS.assignments,a.ASSIGNMENT_ID,a['Trạng thái'],'DA_CHOT');return {ok:true,status:'DA_CHOT'};
}
function upsertComposite_(sheetName,keys,vals,obj){const sh=ss_().getSheetByName(sheetName),v=sh.getDataRange().getValues(),h=v[0].map(String),idx=keys.map(k=>h.indexOf(k));let row=0;for(let i=1;i<v.length;i++)if(idx.every((x,j)=>String(v[i][x])===String(vals[j]))){row=i+1;break;}if(!row){sh.appendRow(h.map(x=>obj[x]===undefined?'':obj[x]));return;}h.forEach((x,j)=>{if(obj[x]!==undefined)sh.getRange(row,j+1).setValue(obj[x])});}
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

function acceptAssignment_(email,data){
  const user=resolveUser_(email);if(!user)throw new Error('USER_NOT_AUTHORIZED');
  const a=readObjects_(SHEETS.assignments).find(r=>String(r.ASSIGNMENT_ID)===String(data.assignmentId));if(!a)throw new Error('ASSIGNMENT_NOT_FOUND');
  if(String(a.ASSIGNEE_ID)!==String(user.EMPLOYEE_ID))throw new Error('OUT_OF_SCOPE');
  if(String(a['Trạng thái'])!=='DA_GIAO')throw new Error('ASSIGNMENT_STATUS_INVALID');
  setAssignmentStatus_(a.ASSIGNMENT_ID,'DA_NHAN');log_(user.USER_ID,'ACCEPT_ASSIGNMENT',SHEETS.assignments,a.ASSIGNMENT_ID,'DA_GIAO','DA_NHAN');return {ok:true,status:'DA_NHAN'};
}


function setAssignmentStatus_(id,status){const sh=ss_().getSheetByName(SHEETS.assignments),v=sh.getDataRange().getValues(),h=v[0].map(String),ic=h.indexOf('ASSIGNMENT_ID'),sc=h.indexOf('Trạng thái');if(ic<0||sc<0)return;for(let i=1;i<v.length;i++)if(String(v[i][ic])===String(id)){sh.getRange(i+1,sc+1).setValue(status);return;}}
function upsertResult_(a,employeeId){
 const records=readObjects_(SHEETS.performance).filter(r=>String(r.ASSIGNMENT_ID)===String(a.ASSIGNMENT_ID)&&String(r['Trạng thái'])!=='TU_CHOI');if(!records.length)return;
 const actual=records.reduce((s,r)=>s+Number(r['Giá trị thực hiện']||0),0),raw=a.Target,missing=raw===''||raw===null||raw===undefined,target=missing?'':Number(raw),direction=String(a['Chiều']||'Tăng').toLowerCase(),weight=Number(a['Trọng số %']||0);
 let completion='',score='',converted='';if(!missing){completion=target===0?(actual===0?1:0):(direction.includes('giảm')?target/Math.max(actual,.0000001):actual/target);score=score_(completion);converted=score*weight/100;}
 const requireConfirm=String(getConfig_('DATA_CONFIRM_REQUIRED','true')).toLowerCase()==='true',allConfirmed=records.every(r=>String(r['Trạng thái'])==='DA_XAC_NHAN'),dataStatus=missing?'CHO_PHE_DUYET_TARGET':(requireConfirm?(allConfirmed?'DA_XAC_NHAN':'CHO_XAC_NHAN'):'DA_XAC_NHAN');
 const obj={PERIOD_ID:a.PERIOD_ID,ASSIGNMENT_ID:a.ASSIGNMENT_ID,EMPLOYEE_ID:employeeId,'Mã KPI':a['Mã KPI'],Target:target,'Thực hiện':actual,'% Hoàn thành':completion,'Điểm 1-5':score,'Trọng số %':weight,'Điểm quy đổi':converted,'Trạng thái dữ liệu':dataStatus,'Trạng thái chốt':'DANG_THUC_HIEN'};upsertByKey_(SHEETS.results,'ASSIGNMENT_ID',a.ASSIGNMENT_ID,obj);
}
function score_(completion){const x=Number(completion||0),t1=Number(getConfig_('SCORE_1_MAX',.7)),t2=Number(getConfig_('SCORE_2_MAX',.85)),t3=Number(getConfig_('SCORE_3_MAX',.95)),t4=Number(getConfig_('SCORE_4_MAX',1));if(x<t1)return 1;if(x<t2)return 2;if(x<t3)return 3;if(x<t4)return 4;return 5;}
