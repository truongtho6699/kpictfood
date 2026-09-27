const API={
  base:'https://script.google.com/macros/s/AKfycbyc1mapNPgjhAHiQrKO_iAjbj7JJnc8VfaDJvxkGeD0G8GdiBdhXyfj-ZSQtFGnOEbJ/exec',
  token:localStorage.getItem('kpiToken')||'',
  setToken(token){this.token=token||'';if(this.token)localStorage.setItem('kpiToken',this.token);else localStorage.removeItem('kpiToken')},
  async login(email,password){const r=await fetch(this.base,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'login',data:{email,password}})});const j=await r.json();if(!j.ok)throw new Error(j.error||'Đăng nhập thất bại');this.setToken(j.token);return j},
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
