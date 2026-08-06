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
   .then(function(){f.innerHTML='<h3>Thank you 🙏</h3><p class="fsub">Your enquiry is in. Dr Khizer\'s team will reach out from drkhizer@caspianobesity.com. To lock a seat now you can also pay ₹2,999 above, or WhatsApp <b>+91 89784 54547</b>.</p>';})
   .catch(function(){btn.textContent='Reserve my seat';btn.style.opacity=1;window.location.href='https://wa.me/918978454547?text='+encodeURIComponent('Hi, I would like to reserve a seat in the CASPIAN Certificate in Obesity Medicine. Name: '+f.name.value+', City: '+f.city.value);});
  return false;
}

// Razorpay Standard Checkout — founding-batch fee (Rs 2,999 = 299900 paise)
function payCaspian(btn){
  if(typeof Razorpay==='undefined'){ alert('Payment is loading — please try again in a moment.'); return; }
  var f=document.getElementById('regform');
  var prefill={};
  if(f){ prefill={name:f.name.value,email:f.email.value,contact:f.phone.value}; }
  if(btn){ btn.disabled=true; btn.dataset.label=btn.textContent; btn.textContent='Starting secure checkout…'; }
  function reset(){ if(btn){ btn.disabled=false; btn.textContent=btn.dataset.label||'Pay ₹2,999 & reserve'; } }
  fetch('/api/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:299900,currency:'INR',receipt:'caspian_founding'})})
    .then(function(r){return r.json();})
    .then(function(o){
      reset();
      if(!o||!o.orderId){ alert('Sorry, we could not start the payment. Please WhatsApp +91 89784 54547 and we will reserve your seat.'); return; }
      var rzp=new Razorpay({
        key:o.keyId, amount:o.amount, currency:o.currency, order_id:o.orderId,
        name:'CASPIAN Certificate in Obesity Medicine',
        description:'Founding-batch seat',
        image:'/favicon.svg',
        prefill:prefill,
        notes:{ city:(f&&f.city&&f.city.value)||'', role:(f&&f.role&&f.role.value)||'' },
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
