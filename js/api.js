const API={
  base:'/api',
  token:localStorage.getItem('kpiToken')||'',
  setToken(token){this.token=token||'';if(this.token)localStorage.setItem('kpiToken',this.token);else localStorage.removeItem('kpiToken')},
  async login(email,password){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);try{const r=await fetch(this.base,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'login',data:{email,password}}),signal:ctl.signal});if(!r.ok)throw new Error('Máy chủ đăng nhập phản hồi lỗi '+r.status);let j;try{j=await r.json()}catch(e){throw new Error('Phản hồi đăng nhập không hợp lệ')};if(!j.ok)throw new Error(j.error||'Email hoặc mật khẩu không đúng');if(!j.token)throw new Error('Máy chủ không trả về phiên đăng nhập');this.setToken(j.token);return j}catch(e){if(e.name==='AbortError')throw new Error('Máy chủ đăng nhập không phản hồi sau 15 giây');if(e instanceof TypeError)throw new Error('Không kết nối được máy chủ đăng nhập. Kiểm tra API/CORS.');throw e}finally{clearTimeout(timer)}},
  async logout(){try{if(this.token)await this.post('logout',{})}catch(e){}this.setToken('')},
  async get(action,params={}){
    const u=new URL(this.base);
    u.searchParams.set('action',action);
    if(this.token)u.searchParams.set('token',this.token);
    Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
    const r=await fetch(u);
    const j=await r.json();
    if(!j.ok)throw new Error(j.error||'Lỗi API');
    return j;
  },
  async post(action,data){
    const r=await fetch(this.base,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action,token:this.token,data})
    });
    const j=await r.json();
    if(!j.ok)throw new Error(j.error||'Lỗi API');
    return j;
  }
};
