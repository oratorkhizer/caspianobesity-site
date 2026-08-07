/* CASPIAN course assistant — instant answers from the official course information.
   Runs entirely in the browser: no chat data is sent anywhere. Unmatched questions
   are handed off to WhatsApp so a human answers. */
(function(){
'use strict';
var WA='https://wa.me/918978454547';
function wa(q){return WA+'?text='+encodeURIComponent(q||'Hi, I have a question about the CASPIAN Certificate in Obesity Medicine.');}

/* ---------- knowledge base (official facts only) ---------- */
var KB=[
 {t:'Fees & what’s included', k:'fee fees cost price charge charges kitna paisa money pay payment amount rupees rs 2999 9999 include included inclusions covering cover expensive cheap discount',
  a:'<p>The founding-batch fee is <b>₹2,999</b> (standard fee ₹9,999) — one-time, for the full programme. It covers all <b>12 in-person modules + the convocation</b>, the <b>course textbook</b>, slide decks, assessments, the dosing quick-reference and Indian-brand formulary, and your <b>certificate</b>.</p>',
  c:[['Apply & reserve','/apply']]},
 {t:'When does it start? Dates & timing', k:'when start date dates begin beginning kab schedule time timing timings day sunday month monthly august 30 session calendar',
  a:'<p>The founding batch begins <b>Sunday, 30 August 2026</b>. After that it runs as <b>one Sunday a month, 10:00 am – 1:00 pm</b>, followed by lunch — 12 monthly modules plus a convocation.</p>'},
 {t:'Where is it held?', k:'where venue location place hall address abids hyderabad city api oasis travel far directions map',
  a:'<p>Sessions are held in person at <b>API Hall, Oasis Plaza, Tilak Road, Abids, Hyderabad</b>.</p>',
  c:[['Open in Google Maps','https://share.google/12DMEZHtgBXY0WuF4']]},
 {t:'Who can join?', k:'who join eligible eligibility criteria qualification mbbs md bams bhms ayush dentist bds nurse physio student intern pg resident doctor physician can i',
  a:'<p>The course is for <b>registered modern-medicine physicians — MBBS and above</b> (GPs, physicians, diabetologists, endocrinologists, surgeons, postgraduates). No prior training in obesity medicine is needed. If you’re unsure whether you qualify, message us and we’ll tell you straight.</p>',
  c:[['Ask on WhatsApp','WA:Am I eligible for the CASPIAN Certificate in Obesity Medicine? My qualification is: ']]},
 {t:'How do I enrol?', k:'enrol enroll register registration apply application book booking reserve seat sign signup admission process steps how',
  a:'<p>Complete the short application at <b>caspianobesity.com/apply</b> and pay the ₹2,999 founding fee securely online — your seat is confirmed the moment payment is received. The founding batch is capped at <b>40 seats</b>, first come, first served.</p>',
  c:[['Start my application','/apply']]},
 {t:'Is there a deadline?', k:'deadline last date closing close cutoff cut off latest till until how long left hurry',
  a:'<p>There’s no fixed last date — <b>enrolment closes when the 40 founding seats fill</b>. Seats are reserved on payment, first come, first served, and Session 1 is on Sunday, 30 August 2026.</p>',
  c:[['Reserve my seat','/apply']]},
 {t:'Refunds & money-back guarantee', k:'refund refunds money back guarantee cancel cancellation return risk worried change mind not satisfied value',
  a:'<p>You’re covered by a money-back guarantee: a <b>full refund any time before Session 1</b>, and if the first session isn’t value for money, a <b>full refund within 7 days of it</b>. After that, one free deferral to the next batch and one free exam retake. Refunds go back to the original payment method, typically in 5–7 working days.</p>',
  c:[['Read the refund policy','/refund']]},
 {t:'The certificate', k:'certificate credential certification award degree diploma fellowship what get receive earn printed name',
  a:'<p>On completing the programme and passing the final exam you receive the <b>CASPIAN Certificate in Obesity Medicine</b>, issued by Caspian Healthcare Foundation, Hyderabad. It’s an independent educational certificate — not a university degree, diploma or fellowship. Every certificate carries a unique Credential ID and QR code, verifiable online.</p>',
  c:[['See certificate verification','/verify']]},
 {t:'Is it accredited? CME credits?', k:'accredited accreditation cme credit credits points recognised recognized approved tsmc nmc mci council valid validity',
  a:'<p>Honest answer: accreditation of the programme by a national professional body in obesity and diabetes is <b>under process</b>, and CME credit points will be applied for from the Telangana State Medical Council once accreditation is granted. What you earn today is an independent educational certificate from Caspian Healthcare Foundation, backed by the full curriculum, assessments and a verifiable credential.</p>'},
 {t:'Attendance rules', k:'attendance attend miss missed absent absence skip travel busy make up makeup recording recordings 80 percent minimum',
  a:'<p>You need to attend at least <b>80% of the live modules</b> (10 of 12) in person. Miss up to two sessions and you keep your place by watching the recording and completing that module’s assessment within 14 days. Miss more than two and we’ll help you defer the outstanding modules to the next cohort.</p>'},
 {t:'Exams & assessments', k:'exam exams test tests assessment assessments quiz quizzes final mcq pass passing marks score distinction fail retake difficulty hard',
  a:'<p>Each module has a short live pre- and post-session quiz plus a feedback form. After Module 12 there’s a <b>60-question final exam</b> — <b>60% to pass, 75% for distinction</b> — and one free retake if you need it.</p>'},
 {t:'The textbook', k:'textbook book books material materials notes study reading obesity medicine indian practice appendix appendices formulary handouts',
  a:'<p>Yes — the course textbook, <b>Obesity Medicine for Indian Practice</b>, is included and yours to keep: 12 modules plus 4 clinical appendices (dosing quick-reference, treatment algorithms, an Indian-brand formulary, and patient handouts). You also get every session’s slide deck.</p>'},
 {t:'Is it online? Are sessions recorded?', k:'online zoom virtual remote hybrid stream streaming video recorded recording distance outside other city state travel',
  a:'<p>The course is <b>in person, in Hyderabad</b> — that’s deliberate: it’s case-based and hands-on. Recordings exist only as a make-up for up to two missed sessions (with that module’s assessment completed within 14 days). If you’re travelling from outside Hyderabad, it’s one Sunday a month.</p>'},
 {t:'Who teaches it?', k:'teacher teaches faculty director instructor trainer khizer junaidy who conduct conducting speaker',
  a:'<p>The course is directed and taught by <b>Dr Khizer Hussain Junaidy, MD</b> — diabetologist and obesity specialist, MD (Pharmacology), Fellowship in Diabetes, and a SCOPE-certified obesity physician (World Obesity Federation). He has delivered 200+ invited talks and CMEs, and wrote the course textbook.</p>',
  c:[['LinkedIn profile','https://www.linkedin.com/in/drkhizerjunaidy/']]},
 {t:'What is the CASPIAN framework?', k:'caspian framework method system approach classify assess screen personalise intervene anchor nurture meaning stands',
  a:'<p><b>CASPIAN</b> is the clinical framework the whole course is built around — one system you run for every patient: <b>C</b>lassify, <b>A</b>ssess, <b>S</b>creen, <b>P</b>ersonalise, <b>I</b>ntervene, <b>A</b>nchor, <b>N</b>urture. It grew out of daily obesity practice at Caspian Healthcare.</p>'},
 {t:'Curriculum — the 12 modules', k:'curriculum syllabus modules module topics content covered cover glp1 glp semaglutide tirzepatide drugs pharmacotherapy surgery bariatric nutrition diet exercise sleep behaviour psychology special populations practice',
  a:'<p>Twelve monthly modules: the new science of obesity; diagnosis &amp; staging (Asian-Indian cut-offs); the obesity consultation; secondary causes &amp; complications; nutrition therapy; activity, exercise &amp; sleep; behavioural care; pharmacotherapy I &amp; II (orlistat to GLP-1s and tirzepatide); bariatric &amp; metabolic surgery; special populations; and building an obesity practice.</p>',
  c:[['See the full curriculum','/#curriculum'],['Download the prospectus (PDF)','/CASPIAN-Prospectus.pdf']]},
 {t:'Sponsorship & independence', k:'sponsor sponsorship pharma pharmaceutical company funded funding independent bias conflict interest',
  a:'<p>The course is funded entirely by participants’ tuition — <b>no pharmaceutical or commercial sponsorship</b> of content, faculty or assessment. Every recommendation is taught on the evidence.</p>'},
 {t:'How do I pay? Is it secure?', k:'pay payment razorpay upi card cards netbanking gpay phonepe paytm secure security safe online transaction failed emi installment installments',
  a:'<p>Payment is a one-time ₹2,999, made securely online through <b>Razorpay</b> at the end of the short application. If a payment fails or you’d like to discuss another way to pay, message us on WhatsApp and we’ll sort it out.</p>',
  c:[['Apply & pay','/apply'],['Payment help on WhatsApp','WA:Hi, I need help with payment for the CASPIAN course.']]},
 {t:'Promo codes', k:'promo code coupon discount voucher complimentary free invite',
  a:'<p>If you have a promo code, enter it at the final step of the application — it’s applied at checkout. Codes are single-use.</p>',
  c:[['Go to the application','/apply']]},
 {t:'Lunch & session day', k:'lunch food meal veg vegetarian jain nonveg snacks tea breakfast eat',
  a:'<p>Each session runs 10:00 am – 1:00 pm and is <b>followed by lunch</b>. Your meal preference (vegetarian / non-vegetarian / Jain) is collected in the application form.</p>'},
 {t:'Seats & batch size', k:'seats seat batch size cohort many people group full sold left remaining available',
  a:'<p>The founding batch is capped at <b>40 seats</b>, kept small on purpose — the teaching is case-based and interactive. Seats are confirmed on payment, first come, first served. For live availability, ask us on WhatsApp.</p>',
  c:[['Check seat availability','WA:Hi, are founding-batch seats still available for the CASPIAN Certificate in Obesity Medicine?']]},
 {t:'Prospectus / brochure', k:'prospectus brochure pdf download details information leaflet flyer share',
  a:'<p>Yes — the full prospectus is a free PDF you can download and share with colleagues.</p>',
  c:[['Download the prospectus (PDF)','/CASPIAN-Prospectus.pdf']]},
 {t:'Verify a certificate', k:'verify verification genuine real fake check qr credential id valid',
  a:'<p>Every CASPIAN certificate carries a unique Credential ID and QR code. Anyone can confirm one is genuine at <b>caspianobesity.com/verify</b> — scan the QR or enter the ID.</p>',
  c:[['Verify a certificate','/verify']]},
 {t:'Contact a human', k:'contact talk speak human person call phone whatsapp email reach help support team question',
  a:'<p>WhatsApp <b>+91 89784 54547</b> or email <b>drkhizer@caspianobesity.com</b> — we usually reply within a working day.</p>',
  c:[['WhatsApp us','WA:'],['Contact page','/contact']]},
 {t:'Do I need prior training?', k:'prior training experience beginner new start background prerequisite needed require first fresher',
  a:'<p>No. The course starts from the science and builds up to prescribing and running a practice — no prior obesity-medicine training is expected. If you already treat diabetes, you’ll move quickly.</p>'},
 {t:'What do I walk away with?', k:'walk away takeaway gain outcome outcomes skills value benefit result learn confident confidence end',
  a:'<p>The full skill set of the CASPIAN framework — one system you run for every patient — plus the course textbook and reference tools, yours to keep, and the CASPIAN Certificate in Obesity Medicine on passing the final exam. The goal: you practise obesity medicine confidently from the very next clinic day.</p>'},
 {t:'What if I skip an assessment or feedback form?', k:'skip skipped forgot incomplete pending outstanding submit late feedback form assessment',
  a:'<p>That module is marked incomplete until its assessment and feedback form are submitted — you can clear any outstanding ones before the final exam. The certificate is issued once attendance (≥80%), all twelve module assessments and feedback forms, and the final exam are complete, so nothing is left hanging.</p>'}
];
var CHIPS=[0,1,3,4,6,8]; // fees, dates, who can join, enrol, refunds, accreditation

/* ---------- matching ---------- */
function norm(s){return (s||'').toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g,' ').replace(/\s+/g,' ').trim();}
function score(q,e){
  var qt=norm(q).split(' ').filter(function(w){return w.length>1;});
  if(!qt.length) return 0;
  var ks=' '+e.k+' '+norm(e.t)+' ', s=0;
  qt.forEach(function(w){
    if(ks.indexOf(' '+w+' ')>-1) s+=3;
    else if(w.length>3 && ks.indexOf(' '+w.slice(0,4))>-1) s+=1;
  });
  return s;
}
function best(q){
  var top=null,ts=0,second=null;
  KB.forEach(function(e){var s=score(q,e); if(s>ts){second=top;top=e;ts=s;} else if(top&&s>0&&e!==top&&(!second||s>score(q,second))){second=e;}});
  return ts>=3?{e:top,alt:second}:null;
}

/* ---------- UI ---------- */
function h(tag,cls,html){var el=document.createElement(tag); if(cls)el.className=cls; if(html!=null)el.innerHTML=html; return el;}
function ctas(e){
  if(!e.c) return '';
  return '<div class="cx-ctas">'+e.c.map(function(c){
    var href=c[1].indexOf('WA:')===0 ? wa(c[1].slice(3)) : c[1];
    var ext=/^https?:/.test(href)?' target="_blank" rel="noopener"':'';
    return '<a class="cx-cta" href="'+href+'"'+ext+'>'+c[0]+'</a>';
  }).join('')+'</div>';
}
function answerBlock(e,qtext){
  var b=h('div','cx-a');
  b.innerHTML=(qtext?'<div class="cx-q">'+qtext.replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];})+'</div>':'')+
    '<div class="cx-t">'+e.t+'</div>'+e.a+ctas(e)+
    '<div class="cx-more">Not what you asked? <a href="'+wa(qtext?('Hi, I asked the site assistant: "'+qtext+'" — could you help?'):'')+'" target="_blank" rel="noopener">Ask us on WhatsApp</a></div>';
  return b;
}
function noMatch(qtext){
  var b=h('div','cx-a');
  b.innerHTML='<div class="cx-t">Let’s get you a proper answer</div>'+
    '<p>I answer from the official course information, and that one’s outside what I have. Send it to the team — a human replies, usually within a working day.</p>'+
    '<div class="cx-ctas"><a class="cx-cta" target="_blank" rel="noopener" href="'+wa('Hi, a question about the CASPIAN Certificate in Obesity Medicine: '+(qtext||''))+'">Ask on WhatsApp</a><a class="cx-cta" href="mailto:drkhizer@caspianobesity.com">Email us</a></div>';
  return b;
}

var fab,panel,body,inp,openState=false;
function build(){
  fab=h('button','cx-fab');
  fab.setAttribute('aria-expanded','false');
  fab.setAttribute('aria-controls','cxPanel');
  fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.9A8 8 0 1 1 21 12z" stroke-linejoin="round"/><path d="M8.5 10.5h7M8.5 13.5h4.5" stroke-linecap="round"/></svg><span>Questions? Ask here</span>';
  fab.addEventListener('click',toggle);

  panel=h('div','cx-panel');
  panel.id='cxPanel'; panel.hidden=true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Course assistant — instant answers');
  panel.innerHTML=
   '<div class="cx-head"><div><b>Course assistant</b><span>Instant answers · official course info</span></div><button class="cx-x" aria-label="Close">×</button></div>'+
   '<div class="cx-body" id="cxBody"></div>'+
   '<form class="cx-in" id="cxForm"><input id="cxInp" type="text" placeholder="Type a question… e.g. What does it cost?" autocomplete="off"/><button class="cx-go" aria-label="Get answer">→</button></form>'+
   '<div class="cx-note">Answers come from the official course information. Nothing you type here leaves your browser — anything unanswered goes to WhatsApp, where a human replies.</div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  body=panel.querySelector('#cxBody');
  inp=panel.querySelector('#cxInp');
  hello();
  panel.querySelector('.cx-x').addEventListener('click',toggle);
  panel.querySelector('#cxForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var q=inp.value.trim(); if(!q) return;
    inp.value='';
    var m=best(q);
    push(m?answerBlock(m.e,q):noMatch(q));
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&openState)toggle();});
  window.caspianAssist={open:function(){if(!openState)toggle();},toggle:toggle};
}
function hello(){
  var w=h('div','cx-a');
  w.innerHTML='<div class="cx-t">Hello, Doctor 👋</div><p>Ask me anything about the CASPIAN Certificate in Obesity Medicine — or tap a question:</p>';
  body.appendChild(w);
  var chips=h('div','cx-chips');
  CHIPS.forEach(function(i){
    var c=h('button','cx-chip',KB[i].t);
    c.type='button';
    c.addEventListener('click',function(){push(answerBlock(KB[i]));});
    chips.appendChild(c);
  });
  var all=h('button','cx-chip cx-chip-all','All questions →');
  all.type='button';
  all.addEventListener('click',function(){
    var g=h('div','cx-chips');
    KB.forEach(function(e){
      var c=h('button','cx-chip',e.t); c.type='button';
      c.addEventListener('click',function(){push(answerBlock(e));});
      g.appendChild(c);
    });
    all.parentNode.replaceChild(g,all);
  });
  chips.appendChild(all);
  body.appendChild(chips);
}
function push(el){body.appendChild(el);body.scrollTop=body.scrollHeight;}
function toggle(){
  openState=!openState;
  panel.hidden=!openState;
  fab.setAttribute('aria-expanded',openState?'true':'false');
  fab.classList.toggle('cx-open',openState);
  if(openState){inp.focus();}
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',build);}else{build();}
})();
