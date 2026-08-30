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

// Countdown to the NEXT module, read from /api/schedule rather than a fixed
// date, so the homepage stops going stale the morning after a session runs.
(function(){
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  fetch('/api/schedule').then(function(r){return r.json();}).then(function(j){
    var rows=(j&&j.rows)||[]; if(!rows.length) return;
    var today=new Date(); today.setHours(0,0,0,0);
    var row=null, dt=null, now=new Date();
    rows.forEach(function(r){
      if(row||!r.session_date||r.status==='cancelled'||r.status==='completed') return;
      var p=String(r.session_date).split('-'), x=new Date(+p[0],+p[1]-1,+p[2]);
      // A session that has already finished today is not the next one.
      var e=String(r.end_time||'13:00').split(':');
      var ends=new Date(+p[0],+p[1]-1,+p[2],+e[0]||13,+e[1]||0);
      if(ends>now){ row=r; dt=x; }
    });
    if(!row) return;
    var d=Math.round((dt-today)/86400000);
    var when=DAYS[dt.getDay()]+', '+dt.getDate()+' '+MONTHS[dt.getMonth()];
    var soon=d===0?'is today':d===1?'is tomorrow':'is in '+d+' days';
    // Only a doctor joining after Module 1 has run needs the catch-up promise.
    var catchup=row.module_no>1?' Join before it starts and sit Module 1 with the next batch.':'';
    var p=document.getElementById('pillDays');
    if(p){p.hidden=false;p.textContent='Module '+row.module_no+' '+soon;}
    var f=document.getElementById('feeCountdown');
    if(f){f.hidden=false;f.textContent='Module '+row.module_no+' '+soon+', '+when+'.'+catchup;}
    var m=document.getElementById('mbarDays');
    if(m){m.textContent='Module '+row.module_no+' '+soon;}
    var g=document.getElementById('nextModuleGlance');
    if(g){g.innerHTML='Module '+row.module_no+', '+when+' &middot; <a href="/schedule" style="color:var(--gold-d);text-decoration:underline">all twelve dates</a>';}
  }).catch(function(){});
})();

// Live enrolment counter. There is no seat cap: the hall takes 100 and every
// doctor who enrols is taken, so this is social proof, not scarcity.
(function(){
  var SHOW_AT=10;
  fetch('/api/seats').then(function(r){return r.json();}).then(function(s){
    if(!s || typeof s.taken!=='number' || s.taken<SHOW_AT) return;
    var p=document.getElementById('pillSeats'); if(p){p.textContent=s.taken+' doctors enrolled';}
    var g=document.getElementById('seatsGlance'); if(g){g.textContent=s.taken+' doctors enrolled so far';}
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

// Share the Course Director's video. Always shares the LINK (not a bare file), so the
// recipient gets a rich preview and is one tap from the site. Native sheet on mobile,
// clipboard on desktop, WhatsApp as the last resort.
(function(){
  var btn=document.getElementById('shareVideo'); if(!btn) return;
  var url='https://caspianobesity.com/#director-message';
  var title='CASPIAN Certificate in Obesity Medicine';
  var text="A short message from Dr Khizer Hussain Junaidy on the CASPIAN Certificate in Obesity Medicine, 12 monthly modules for Indian physicians. The founding batch is under way in Hyderabad.";
  var msg=document.getElementById('shareMsg');
  function say(t){ if(msg){ msg.textContent=t; msg.style.display='block'; } }
  btn.addEventListener('click',function(){
    if(navigator.share){
      navigator.share({title:title,text:text,url:url})
        .then(function(){ say('Thank you for sharing.'); })
        .catch(function(){});
      return;
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text+' '+url)
        .then(function(){ say('Link copied. Paste it into WhatsApp, an email or a group.'); })
        .catch(function(){ window.open('https://wa.me/?text='+encodeURIComponent(text+' '+url),'_blank','noopener'); });
      return;
    }
    window.open('https://wa.me/?text='+encodeURIComponent(text+' '+url),'_blank','noopener');
  });
})();

// sticky mobile CTA bar, appears once the hero CTA has scrolled away
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
  var data={name:f.name.value,email:f.email.value,phone:f.phone.value,city:f.city.value,role:f.role.value,question:f.msg.value,_subject:'New seat enquiry, CASPIAN Obesity Medicine',_template:'table'};
  fetch('https://formsubmit.co/ajax/drkhizer@caspianobesity.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
   .then(function(r){return r.json();})
   .then(function(){f.innerHTML='<h3>Thank you 🙏</h3><p class="fsub">Your enquiry is in. Dr Khizer\'s team will reach out from drkhizer@caspianobesity.com. Seats are reserved on payment of the ₹2,999 founding fee: you can <a href="/apply" style="color:var(--gold-d);text-decoration:underline">apply and pay securely</a> to join the founding batch.</p>';})
   .catch(function(){btn.textContent='Send my enquiry';btn.style.opacity=1;window.location.href='https://wa.me/918978454547?text='+encodeURIComponent('Hi, I have a question about the CASPIAN Certificate in Obesity Medicine. Name: '+f.name.value+', City: '+f.city.value);});
  return false;
}

// Cache-bust the Course Director video. The file was replaced at the same URL while a
// 30-day cache header was in force, so a browser that fetched the earlier cut (or a
// partial copy served while the CDN was still filling the new one) can keep serving that
// stale copy from disk. Pointing the source at a versioned URL forces one clean fetch.
(function(){
  var VER='2';
  var s=document.querySelector('#director-message source[src="/caspian-intro.mp4"]');
  if(!s) return;
  s.setAttribute('src','/caspian-intro.mp4?v='+VER);
  var v=s.parentNode;
  if(v && typeof v.load==='function') v.load();
})();

// What the founding batch said. Rendered from /api/testimonials rather than
// written into the page, because the quotes grow by one module a month and a
// hand-maintained list would go stale. Only consented, curated quotes come back.
(function(){
  var anchor=document.getElementById('faq'); if(!anchor) return;
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  fetch('/api/testimonials').then(function(r){return r.json();}).then(function(j){
    var q=(j&&j.quotes)||[]; if(!q.length) return;
    var s=(j&&j.stats)||{};

    // The site's .stat tiles are built for a navy band; on white their labels
    // wash out, so these carry their own colours.
    function tile(n,l){
      return '<div style="text-align:center;padding:6px 10px">'+
             '<div style="font-family:\'Playfair Display\',Georgia,serif;font-weight:800;font-size:2.6rem;color:var(--navy);line-height:1">'+n+'</div>'+
             '<div style="font-size:.8rem;color:#5b6b7a;margin-top:6px;letter-spacing:.02em">'+l+'</div></div>';
    }
    var tiles='';
    if(s.responses) tiles+=tile(s.responses,'Doctors gave feedback');
    if(s.recommend!=null) tiles+=tile(s.recommend+'%','Would recommend it to a colleague');
    if(s.avg!=null) tiles+=tile(s.avg,'Average rating out of 5');

    var cards=q.map(function(x){
      var who=[x.name, x.role].filter(Boolean).map(esc).join(', ');
      return '<div class="card reveal in" style="text-align:left">'+
             '<p style="font-family:\'Playfair Display\',Georgia,serif;font-style:italic;font-size:1.06rem;color:var(--navy);line-height:1.5;margin:0 0 14px">&ldquo;'+esc(x.text)+'&rdquo;</p>'+
             (who?'<div style="font-size:.84rem;font-weight:700;color:var(--gold-d)">'+who+'</div>':'')+
             '<div style="font-size:.76rem;color:var(--muted)">Founding batch &middot; Module '+(x.module||1)+'</div>'+
             '</div>';
    }).join('');

    var sec=document.createElement('section');
    sec.className='why'; sec.id='voices';
    sec.style.background='#fff';
    sec.innerHTML=
      '<div class="wrap">'+
       '<div class="sec-head reveal in">'+
        '<span class="eyebrow" style="color:var(--gold-d)">From the founding batch</span>'+
        '<h2>What the first cohort took away.</h2>'+
        '<p>After each module we ask every doctor in the room what was most useful. These are their own words, published with their permission.</p>'+
       '</div>'+
       (tiles?'<div style="display:flex;justify-content:center;gap:48px;flex-wrap:wrap;margin:0 0 34px">'+tiles+'</div>':'')+
       '<div class="grid">'+cards+'</div>'+
      '</div>';
    anchor.parentNode.insertBefore(sec, anchor);
  }).catch(function(){});
})();
