const API={
  base:'https://script.google.com/macros/s/AKfycbyc1mapNPgjhAHiQrKO_iAjbj7JJnc8VfaDJvxkGeD0G8GdiBdhXyfj-ZSQtFGnOEbJ/exec',
  email:localStorage.getItem('kpiEmail')||'ceo@ctfoods.vn',
  set(url,email){
    // Production API URL is fixed; keep only the temporary test identity locally.
    this.email=(email||'').trim();
    localStorage.setItem('kpiEmail',this.email);
  },
  async get(action,params={}){
    const u=new URL(this.base);
    u.searchParams.set('action',action);
    if(this.email)u.searchParams.set('email',this.email);
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
      body:JSON.stringify({action,email:this.email,data})
    });
    const j=await r.json();
    if(!j.ok)throw new Error(j.error||'Lỗi API');
    return j;
  }
};
