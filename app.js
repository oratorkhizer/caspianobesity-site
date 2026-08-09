// mobile menu
var _burger=document.getElementById('burger');
_burger.addEventListener('click',function(){
  var open=document.getElementById('navlinks').classList.toggle('open');
  _burger.setAttribute('aria-expanded', open?'true':'false');
});
document.querySelectorAll('#navlinks a').forEach(function(a){
  a.addEventListener('click',function(){
    document.getElementById('navlinks').classList.remove('open');
    _burger.setAttribute('aria-expanded','false');
  });
});
// reveal on scroll
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
// safety net: never leave content hidden
setTimeout(function(){document.querySelectorAll('.reveal:not(.in)').forEach(function(el){var r=el.getBoundingClientRect();if(r.top<window.innerHeight+80)el.classList.add('in');});},1200);
window.addEventListener('load',function(){document.querySelectorAll('.reveal').forEach(function(el){var r=el.getBoundingClientRect();if(r.top<window.innerHeight)el.classList.add('in');});});
// hero rays
(function(){
  var g=document.querySelector('.hero .rays g'); if(!g) return;
  var cx=600, cy=40, html='';
  for(var i=0;i<40;i++){var a=(i/40)*Math.PI*2; var x=cx+Math.cos(a)*1300, y=cy+Math.sin(a)*1300; html+='<line x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(0)+'" y2="'+y.toFixed(0)+'"/>';}
  g.innerHTML=html;
})();

// countdown to Session 1 (Sunday 30 Aug 2026, 10:00 IST) — hides itself once the course starts
(function(){
  var t=new Date('2026-08-30T10:00:00+05:30');
  var d=Math.ceil((t-new Date())/86400000);
  if(d<=0) return;
  var label=d===1?'Starts tomorrow':'Starts in '+d+' days';
  var p=document.getElementById('pillDays'); if(p){p.hidden=false;p.textContent=label;}
  var f=document.getElementById('feeCountdown');
  if(f){f.hidden=false;f.textContent=(d===1?'Session 1 is tomorrow':'Session 1 is in '+d+' days')+' — Sunday, 30 August 2026';}
  var m=document.getElementById('mbarDays'); if(m){m.textContent=d===1?'starts tomorrow':'starts in '+d+' days';}
})();

// live seat counter — shows real numbers only once enough founding seats are taken
(function(){
  var SHOW_AT=10;
  fetch('/api/seats').then(function(r){return r.json();}).then(function(s){
    if(!s || !s.cap || typeof s.taken!=='number' || s.taken<SHOW_AT) return;
    var left=Math.max(0,s.cap-s.taken);
    var p=document.getElementById('pillSeats'); if(p){p.textContent=s.taken+' of '+s.cap+' seats taken';}
    var g=document.getElementById('seatsGlance'); if(g){g.textContent='Capped at '+s.cap+' — '+s.taken+' taken, '+left+' left';}
  }).catch(function(){});
})();

// Asset guard: the intro video and the endorsement photo are uploaded separately.
// Until they exist, hide those sections rather than showing a broken player/image.
(function(){
  var probe=new Image();
  probe.onerror=function(){
    var s=document.getElementById('director-message'); if(s) s.remove();
    var a=document.querySelector('a[href="#director-message"]');
    if(a && a.parentNode) a.parentNode.remove();
  };
  probe.src='/video-poster.jpg';

  var rr=document.querySelector('img[src="/raghu-ramulu.jpg"]');
  if(rr){
    var drop=function(){ var s=rr.closest('section'); if(s) s.remove(); };
    if(rr.complete && rr.naturalWidth===0) drop(); else rr.addEventListener('error',drop);
  }
})();

// sticky mobile CTA bar — appears once the hero CTA has scrolled away
(function(){
  var bar=document.getElementById('mbar'); if(!bar) return;
  var ticking=false;
  function upd(){
    ticking=false;
    var show=window.scrollY>560;
    bar.hidden=!show;
    document.body.classList.toggle('has-mbar',show);
  }
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(upd);}},{passive:true});
  upd();
})();

// form -> FormSubmit AJAX (works on desktop; no mailto). First submission triggers a one-time activation email to drkhizer@caspianobesity.com.
function submitForm(ev){
  ev.preventDefault();
  var f=ev.target, btn=f.querySelector('button[type=submit]');
  btn.textContent='Sending…'; btn.style.opacity=.7;
  var data={name:f.name.value,email:f.email.value,phone:f.phone.value,city:f.city.value,role:f.role.value,question:f.msg.value,_subject:'New seat enquiry — CASPIAN Obesity Medicine',_template:'table'};
  fetch('https://formsubmit.co/ajax/drkhizer@caspianobesity.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
   .then(function(r){return r.json();})
   .then(function(){f.innerHTML='<h3>Thank you 🙏</h3><p class="fsub">Your enquiry is in — Dr Khizer\'s team will reach out from drkhizer@caspianobesity.com. Seats are reserved on payment of the ₹2,999 founding fee: you can <a href="/apply" style="color:var(--gold-d);text-decoration:underline">apply and pay securely</a> to lock one of the 40 founding seats.</p>';})
   .catch(function(){btn.textContent='Send my enquiry';btn.style.opacity=1;window.location.href='https://wa.me/918978454547?text='+encodeURIComponent('Hi, I have a question about the CASPIAN Certificate in Obesity Medicine. Name: '+f.name.value+', City: '+f.city.value);});
  return false;
}
