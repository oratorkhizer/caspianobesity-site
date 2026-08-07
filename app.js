// mobile menu
document.getElementById('burger').addEventListener('click',function(){
  document.getElementById('navlinks').classList.toggle('open');
});
document.querySelectorAll('#navlinks a').forEach(function(a){
  a.addEventListener('click',function(){document.getElementById('navlinks').classList.remove('open');});
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
// form -> FormSubmit AJAX (works on desktop; no mailto). First submission triggers a one-time activation email to drkhizer@caspianobesity.com.
function submitForm(ev){
  ev.preventDefault();
  var f=ev.target, btn=f.querySelector('button[type=submit]');
  btn.textContent='Sending…'; btn.style.opacity=.7;
  var data={name:f.name.value,email:f.email.value,phone:f.phone.value,city:f.city.value,role:f.role.value,question:f.msg.value,_subject:'New seat enquiry — CASPIAN Obesity Medicine',_template:'table'};
  fetch('https://formsubmit.co/ajax/drkhizer@caspianobesity.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
   .then(function(r){return r.json();})
   .then(function(){f.innerHTML='<h3>Thank you 🙏</h3><p class="fsub">Your enquiry is in — Dr Khizer\'s team will reach out from drkhizer@caspianobesity.com. Seats are reserved on payment of the ₹2,999 founding fee: you can pay securely above to lock one of the 40 founding seats.</p>';})
   .catch(function(){btn.textContent='Send my enquiry';btn.style.opacity=1;window.location.href='https://wa.me/918978454547?text='+encodeURIComponent('Hi, I have a question about the CASPIAN Certificate in Obesity Medicine. Name: '+f.name.value+', City: '+f.city.value);});
  return false;
}

// Razorpay Standard Checkout — founding-batch seat.
// The server decides the price; the browser only passes an optional promo code.
function _promoFor(btn){
  var sec = btn && btn.closest ? btn.closest('section') : null;
  return sec ? sec.querySelector('.promo-input') : null;
}
function _promoMsgFor(btn){
  var sec = btn && btn.closest ? btn.closest('section') : null;
  return sec ? sec.querySelector('.promo-msg') : null;
}
function _setPromoMsg(el,text,kind){
  if(!el) return;
  el.textContent=text||'';
  el.style.display=text?'block':'none';
  el.style.color = kind==='ok' ? '#2e7d52' : (kind==='bad' ? '#c0554f' : '');
}

// Free seat (100%-off code): no payment — capture enrolment details and confirm.
function _freeSeat(o, f, btn){
  var msg=_promoMsgFor(btn);
  var label=(o.promo&&o.promo.label)||'Complimentary seat';
  if(f && f.name && f.email && f.phone && f.name.value && f.email.value && f.phone.value){
    _setPromoMsg(msg,'Confirming your complimentary seat…','ok');
    var data={name:f.name.value,email:f.email.value,phone:f.phone.value,city:(f.city&&f.city.value)||'',role:(f.role&&f.role.value)||'',
      question:'COMPLIMENTARY SEAT via code '+((o.promo&&o.promo.code)||''),
      _subject:'Complimentary seat — CASPIAN Obesity Medicine ('+((o.promo&&o.promo.code)||'')+')',_template:'table'};
    fetch('https://formsubmit.co/ajax/drkhizer@caspianobesity.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json();})
      .then(function(){ window.location.href='/thanks.html?free=1'; })
      .catch(function(){ _setPromoMsg(msg,'Your code is valid (‘'+label+'’). Please WhatsApp +91 89784 54547 with your name to confirm your seat.','ok'); });
  } else {
    _setPromoMsg(msg,'Your code is valid — ‘'+label+'’. Fill in your name, email and phone in the form below, then click again to confirm your complimentary seat.','ok');
    var reg=document.getElementById('register'); if(reg&&reg.scrollIntoView) reg.scrollIntoView({behavior:'smooth'});
  }
  if(btn){ btn.disabled=false; btn.textContent=btn.dataset.label||'Reserve your seat'; }
}

function payCaspian(btn){
  var promoEl=_promoFor(btn), msg=_promoMsgFor(btn);
  var code=promoEl && promoEl.value ? promoEl.value.trim() : '';
  var f=document.getElementById('regform');
  var prefill={};
  if(f){ prefill={name:f.name.value,email:f.email.value,contact:f.phone.value}; }
  if(btn){ btn.disabled=true; btn.dataset.label=btn.dataset.label||btn.textContent; btn.textContent='Starting secure checkout…'; }
  _setPromoMsg(msg,'','');
  function reset(){ if(btn){ btn.disabled=false; btn.textContent=btn.dataset.label||'Reserve your seat'; } }

  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({promo:code,currency:'INR',receipt:'caspian_founding'})})
    .then(function(r){return r.json();})
    .then(function(o){
      if(!o){ reset(); alert('Sorry, we could not start the payment. Please WhatsApp +91 89784 54547 and we will reserve your seat.'); return; }
      // promo feedback
      if(o.promo && o.promo.code){
        if(o.promo.applied){ _setPromoMsg(msg,'Code ‘'+o.promo.code+'’ applied — '+(o.promo.label||'discount')+'.','ok'); }
        else { _setPromoMsg(msg, (o.promo.error||'That code isn’t valid')+'. Continuing at the standard fee.','bad'); }
      }
      // Free seat path
      if(o.free){ _freeSeat(o,f,btn); return; }
      reset();
      if(typeof Razorpay==='undefined'){ alert('Payment is loading — please try again in a moment.'); return; }
      if(!o.orderId){ alert('Sorry, we could not start the payment. Please WhatsApp +91 89784 54547 and we will reserve your seat.'); return; }
      var rupees=(o.amount/100).toLocaleString('en-IN');
      var rzp=new Razorpay({
        key:o.keyId, amount:o.amount, currency:o.currency, order_id:o.orderId,
        name:'CASPIAN Certificate in Obesity Medicine',
        description:'Founding-batch seat'+(o.promo&&o.promo.applied?(' · '+o.promo.label):''),
        image:'/favicon.svg',
        prefill:prefill,
        notes:{ city:(f&&f.city&&f.city.value)||'', role:(f&&f.role&&f.role.value)||'', promo:(o.promo&&o.promo.applied?o.promo.code:'') },
        theme:{ color:'#0e2643' },
        handler:function(resp){
          fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(resp)})
            .then(function(r){return r.json();})
            .then(function(v){
              if(v&&v.verified){ window.location.href='/thanks.html?paid=1'; }
              else { alert('We could not verify the payment. If money was deducted, WhatsApp +91 89784 54547 with your payment id and we will sort it out.'); }
            })
            .catch(function(){ alert('Payment received but verification did not complete. Please WhatsApp +91 89784 54547.'); });
        },
        modal:{ ondismiss:function(){ /* user closed the checkout */ } }
      });
      rzp.on('payment.failed', function(e){ alert('Payment failed: '+((e&&e.error&&e.error.description)||'please try again or use another method.')); });
      rzp.open();
    })
    .catch(function(){ reset(); alert('Network error starting payment. Please try again, or WhatsApp +91 89784 54547.'); });
}
