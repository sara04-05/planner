<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// The public front page. Logged-in visitors go straight to their planner.
if (current_user_id()) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="A free study, task and money planner for students. Plan your day, track exams and see where your money goes.">
  <title>Splanner · Study, tasks & money in one notebook</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=8">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
  <style>
    /* ---- landing page only ---- */
    .land{max-width:1180px;margin:0 auto}
    .lnav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 0;flex-wrap:wrap}
    .lnav .brand b{font-size:22px}
    .lnav nav{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
    .lnav nav a{color:var(--muted);font-weight:600;font-size:14px;text-decoration:none}
    .lnav nav a:hover{color:var(--ink)}
    a.btn{text-decoration:none;color:inherit}
    a.btn.primary{color:var(--on-accent)}

    .hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr);gap:48px;align-items:center;padding:36px 0 64px}
    .hero h1{font-size:clamp(34px,5vw,54px);line-height:1.05}
    .hero .lead{font-size:18px;color:var(--muted);margin:22px 0 28px;max-width:32em}
    .cta{display:flex;gap:10px;flex-wrap:wrap}
    .cta .btn{padding:12px 18px;font-size:15px;border-radius:12px}
    .trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:26px;font-size:13px;color:var(--muted);font-weight:600}
    .trust span{display:inline-flex;gap:6px;align-items:center}
    .trust svg{width:16px;height:16px;color:var(--good)}

    /* live preview */
    .demo-wrap{position:relative}
    .demo-badge{position:absolute;top:-14px;left:40px;z-index:3;background:var(--sticky);color:var(--sticky-ink);font-weight:700;font-size:12px;padding:5px 12px;border-radius:4px;transform:rotate(-2deg);box-shadow:0 4px 10px rgba(0,0,0,.1)}
    .demo .page{min-height:430px;padding:26px 24px 24px 60px}
    .demo .tab{font-size:13px;padding:12px 8px 12px 10px;width:38px}
    .demo .tab[aria-selected="true"]{width:46px}
    .demo.binder{grid-template-columns:minmax(0,1fr) 46px}
    .demo h2.dh{display:inline;font-size:26px;font-weight:700;background:linear-gradient(transparent 58%,var(--hl) 58%,var(--hl) 90%,transparent 90%);padding:0 4px;margin-left:-4px}
    .demo .vh{margin-bottom:18px}
    .demo .panel{padding:14px}
    .demo-note{text-align:center;font-size:13px;color:var(--muted);margin-top:18px}

    section.blk{padding:64px 0;border-top:1px solid var(--line)}
    .sh{max-width:640px;margin-bottom:32px}
    .sh h2{font-size:clamp(26px,3.4vw,34px);font-weight:700}
    .sh p{color:var(--muted);margin-top:10px;font-size:16px}

    .feat{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
    .fc{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px 18px 20px;border-top:6px solid var(--fc)}
    .fc h3{font-size:18px;margin-bottom:6px}
    .fc p{color:var(--muted);font-size:14px}

    .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;counter-reset:s}
    .step{background:var(--paper-2);border-radius:16px;padding:20px}
    .step::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--on-accent);font-family:var(--display);font-weight:700;margin-bottom:12px}
    .step h3{font-size:17px;margin-bottom:4px}
    .step p{font-size:14px;color:var(--muted)}

    .safe{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
    .safe-card{background:var(--paper);border-radius:6px 20px 20px 6px;padding:26px;box-shadow:4px 4px 0 -1px var(--edge),4px 4px 0 0 var(--line),var(--shadow)}
    .safe-card h3{font-size:18px;margin-bottom:12px}
    .checks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
    .checks li{display:flex;gap:10px;font-size:14px}
    .checks li i{flex-shrink:0;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:12px}
    .checks.yes li i{background:var(--good-soft);color:var(--good)}
    .checks.no li i{background:var(--bad-soft);color:var(--bad)}
    .checks b{display:block}
    .checks span{color:var(--muted)}

    .faq details{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px}
    .faq summary{cursor:pointer;font-weight:700;font-family:var(--display);font-size:17px}
    .faq details p{color:var(--muted);margin-top:8px;font-size:15px}

    .final{text-align:center;padding:64px 20px;margin:24px 0;background:var(--accent-soft);border-radius:24px}
    .final h2{font-size:clamp(26px,3.4vw,34px)}
    .final p{color:var(--muted);margin:10px 0 22px}
    .final .cta{justify-content:center}
    .lfoot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:24px 0 40px;font-size:13px;color:var(--muted)}
    .lfoot a{color:var(--muted)}

    @media (max-width:980px){
      .hero{grid-template-columns:1fr;gap:40px}
      .safe{grid-template-columns:1fr}
    }
    @media (max-width:760px){
      .steps{grid-template-columns:1fr}
      .lnav nav a:not(.btn){display:none}
      .demo .page{padding:20px 16px;min-height:380px}
      .demo.binder{grid-template-columns:1fr}
      .demo .tab{width:auto;font-size:13px;padding:8px 12px 11px}
      .demo .tab[aria-selected="true"]{width:auto}
      .demo-badge{position:static;display:inline-block;margin:0 0 10px 6px}
    }
  </style>
</head>
<body>
<div class="land">

  <header class="lnav">
    <a class="logo" href="welcome.php">Splanner</a>
    <nav aria-label="Main">
      <a href="#features">Features</a>
      <a href="#safety">Is it safe?</a>
      <a href="#faq">FAQ</a>
      <a class="btn ghost" href="login.php">Log in</a>
      <a class="btn primary" href="register.php">Create free account</a>
    </nav>
  </header>

  <!-- HERO -->
  <section class="hero">
    <div>
      <p class="eyebrow">Free student planner · no ads</p>
      <h1>Your studies, tasks and money in one notebook.</h1>
      <p class="lead">Plan your day hour by hour, count down to exams, tick off chapters and see exactly where your money goes each week. Try it right here before you sign up.</p>
      <div class="cta">
        <a class="btn primary" href="#demo">Try the live preview</a>
        <a class="btn" href="register.php">Create free account</a>
      </div>
      <div class="trust">
        <span><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 13.2 4.8 10l-1.4 1.4L8 16l9-9-1.4-1.4z"/></svg>No ads or tracking</span>
        <span><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 13.2 4.8 10l-1.4 1.4L8 16l9-9-1.4-1.4z"/></svg>Only your email is needed</span>
        <span><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 13.2 4.8 10l-1.4 1.4L8 16l9-9-1.4-1.4z"/></svg>Delete your data anytime</span>
      </div>
    </div>

    <!-- LIVE PREVIEW -->
    <div class="demo-wrap" id="demo">
      <div class="demo-badge">Live preview · sample data</div>
      <div class="binder demo">
        <div class="coil" aria-hidden="true" id="coil"></div>
        <div class="page" id="dview" aria-live="polite"></div>
        <nav class="tabs" role="tablist" aria-label="Preview sections">
          <button class="tab" role="tab" data-tab="day">Day</button>
          <button class="tab" role="tab" data-tab="week">Week</button>
          <button class="tab" role="tab" data-tab="study">Study</button>
          <button class="tab" role="tab" data-tab="tasks">Tasks</button>
          <button class="tab" role="tab" data-tab="money">Expenses</button>
        </nav>
      </div>
      <p class="demo-note">Click the tabs. Tick a task. Nothing here is saved, it's just a preview.</p>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="blk" id="features">
    <div class="sh">
      <h2>Seven pages, one planner</h2>
      <p>Each tab is a page in the notebook. Use the ones you need and ignore the rest.</p>
    </div>
    <div class="feat">
      <div class="fc" style="--fc:var(--t-day)"><h3>Day</h3><p>An hour-by-hour plan with study, class, work and free-time blocks, plus today's tasks and spending.</p></div>
      <div class="fc" style="--fc:var(--t-week)"><h3>Week</h3><p>All seven days side by side, so you can see busy days coming before they arrive.</p></div>
      <div class="fc" style="--fc:var(--t-month)"><h3>Month</h3><p>A calendar with how much you spent each day and which days have deadlines.</p></div>
      <div class="fc" style="--fc:var(--t-year)"><h3>Year</h3><p>Month-by-month totals and how much you've managed to save.</p></div>
      <div class="fc" style="--fc:var(--t-study)"><h3>Study</h3><p>Subjects split into chapters and topics, with exam countdowns and progress bars.</p></div>
      <div class="fc" style="--fc:var(--t-tasks)"><h3>Tasks</h3><p>To-dos with due dates and priorities, grouped into overdue, today and later.</p></div>
      <div class="fc" style="--fc:var(--t-money)"><h3>Expenses</h3><p>Log what you spend in seconds, set a weekly budget and see it by category.</p></div>
    </div>
  </section>

  <!-- HOW -->
  <section class="blk">
    <div class="sh"><h2>How it works</h2></div>
    <div class="steps">
      <div class="step"><h3>Create an account</h3><p>Just a name, email and password. No phone number, no card, no social login.</p></div>
      <div class="step"><h3>Fill in your notebook</h3><p>Add your subjects, exam dates and weekly budget. It takes about two minutes.</p></div>
      <div class="step"><h3>Open it every morning</h3><p>Everything saves as you type, and it works on your phone and laptop.</p></div>
    </div>
  </section>

  <!-- SAFETY -->
  <section class="blk" id="safety">
    <div class="sh">
      <h2>Why is there a login, and is it safe?</h2>
      <p>The login is only there so your planner stays private to you. Here is exactly what happens to your information.</p>
    </div>
    <div class="safe">
      <div class="safe-card">
        <h3>What we do</h3>
        <ul class="checks yes">
          <li><i>✓</i><div><b>Store your password scrambled</b><span>It's hashed, so not even the site owner can read it.</span></div></li>
          <li><i>✓</i><div><b>Keep your planner private</b><span>Every save is tied to your account. No one else can see it.</span></div></li>
          <li><i>✓</i><div><b>Use a secure connection</b><span>Look for the padlock in the address bar.</span></div></li>
          <li><i>✓</i><div><b>Let you leave anytime</b><span>Delete your account and all your data is gone.</span></div></li>
        </ul>
      </div>
      <div class="safe-card">
        <h3>What we never do</h3>
        <ul class="checks no">
          <li><i>✕</i><div><b>Ask for your university or email password</b><span>Make a new password just for this site.</span></div></li>
          <li><i>✕</i><div><b>Ask for card or bank details</b><span>The expense tracker is just numbers you type in.</span></div></li>
          <li><i>✕</i><div><b>Show ads or sell your data</b><span>Your data is used only to run your planner.</span></div></li>
          <li><i>✕</i><div><b>Send you emails you didn't ask for</b><span>Your email is only used to log in.</span></div></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="blk faq" id="faq">
    <div class="sh"><h2>Questions</h2></div>
    <details><summary>Is it free?</summary><p>Yes, completely. There is no paid version.</p></details>
    <details><summary>Can I use it on my phone?</summary><p>Yes. The notebook tabs move to the top on small screens.</p></details>
    <details><summary>Do I need to install anything?</summary><p>No. It runs in your browser, so you just log in from any phone or computer.</p></details>
    <details><summary>Will I lose my plans if I switch devices?</summary><p>No. Everything is saved to your account as you type, so you'll find the same notebook on your phone and your laptop.</p></details>
    <details><summary>Does it connect to my bank?</summary><p>No. You type in what you spend yourself. The planner never sees your bank account or card.</p></details>
    <details><summary>What currency does it use?</summary><p>Amounts are shown in euros (€).</p></details>
    <details><summary>Is there a dark mode?</summary><p>Yes. It follows your device setting, and you can switch it with one button at the top of the planner.</p></details>
    <details><summary>Can other people see my planner?</summary><p>No. Your planner is only visible when you're logged in to your own account.</p></details>
  </section>

  <div class="final">
    <h2>Ready to plan your week?</h2>
    <p>It takes under a minute to set up.</p>
    <div class="cta"><a class="btn primary" href="register.php">Create free account</a><a class="btn" href="login.php">I already have one</a></div>
  </div>

  <footer class="lfoot">
    <span class="logo sm">Splanner<span style="font-family:var(--body);font-size:13px;font-weight:500;letter-spacing:0;color:var(--muted);margin-left:6px">© 2026</span></span>
    <span><a href="#safety">Privacy</a></span>
  </footer>
</div>

<script>
(function(){
  document.getElementById('coil').innerHTML='<span></span>'.repeat(40);
  var tasks=[{t:'Finish OOP lab report',s:'Due today',p:'high',d:false},{t:'Read chapter 4, Databases',s:'Tomorrow',p:'med',d:false},{t:'Buy notebook',s:'Friday',p:'low',d:true},{t:'Email group about project',s:'Friday',p:'med',d:false}];
  var hours=[['08:00','Class','Algorithms lecture','var(--c-school)'],['10:00','Study','Databases, ch. 4','var(--accent)'],['12:00','Free','Lunch with Ana','var(--c-groceries)'],['14:00','Study','OOP lab report','var(--accent)'],['17:00','Work','Café shift','var(--c-phone)']];
  var cats=[['Food','var(--c-food)',24.5],['Coffee','var(--c-coffee)',9],['Transport','var(--c-transport)',6],['School','var(--c-school)',12.8],['Fun','var(--c-fun)',8]];
  function head(ey,t,right){return '<div class="vh"><div><p class="eyebrow">'+ey+'</p><h2 class="dh">'+t+'</h2></div>'+(right||'')+'</div>'}
  function taskRows(list){return list.map(function(x,i){return '<div class="row'+(x.d?' done':'')+'"><input type="checkbox" data-i="'+tasks.indexOf(x)+'"'+(x.d?' checked':'')+' aria-label="Done"><span class="prio '+x.p+'"></span><div class="grow"><div class="t">'+x.t+'</div><div class="s">'+x.s+'</div></div></div>'}).join('')}
  var views={
    day:function(){return head('Saturday, 26 September','Today','<span class="pill good">3 study hours</span>')+
      '<div class="cols"><div>'+hours.map(function(h){return '<div class="hr" style="--hc:'+h[3]+';grid-template-columns:48px 70px minmax(0,1fr)"><span class="hl">'+h[0]+'</span><span style="font-size:12px;font-weight:700;color:'+h[3]+'">'+h[1]+'</span><span style="font-size:14px">'+h[2]+'</span></div>'}).join('')+'</div>'+
      '<div class="stack"><div class="panel"><div class="sec-h"><h2>Tasks</h2><span class="meta">'+tasks.filter(function(x){return x.d}).length+'/'+tasks.length+'</span></div>'+taskRows(tasks.slice(0,2))+'</div>'+
      '<div class="sticky"><p class="eyebrow">Note to self</p><div style="font-family:var(--display);font-size:18px;font-weight:600">Exam in 9 days, you got this!</div></div></div></div>'},
    week:function(){var d=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],items=[['Algorithms','OOP lab'],['Gym'],['Databases quiz'],['Group meeting','Café shift'],['Buy notebook'],['Study ch. 4','Café shift'],['Rest']];
      return head('Week 39','This week')+'<div class="wk-scroll" style="margin:0"><div class="weekgrid" style="grid-template-columns:repeat(7,minmax(110px,1fr))">'+d.map(function(n,i){return '<div class="wd'+(i===5?' is-today':'')+'" style="min-height:150px"><div class="wd-h"><b>'+(21+i)+'</b><span>'+n+'</span></div><ul>'+items[i].map(function(t){return '<li><span class="dot" style="background:var(--accent)"></span>'+t+'</li>'}).join('')+'</ul><div class="foot"><span>Spent</span><span class="amt">€'+[6,4.5,11,8,3,12.3,0][i]+'</span></div></div>'}).join('')+'</div></div>'},
    study:function(){var s=[['Databases','var(--c-school)',62,'Exam in 9 days','warn'],['Algorithms','var(--c-transport)',40,'Exam in 23 days','muted'],['OOP','var(--c-food)',85,'Lab due today','bad']];
      return head('3 subjects','Study')+'<div class="stack" style="gap:14px">'+s.map(function(x){return '<div class="subj" style="--sc:'+x[1]+';padding:14px 16px"><div class="subj-h" style="margin-bottom:8px"><h3>'+x[0]+'</h3><span class="pill '+x[4]+'">'+x[3]+'</span></div><div class="meter"><span style="width:'+x[2]+'%;background:'+x[1]+'"></span></div><div class="s" style="font-size:12px;color:var(--muted);margin-top:6px">'+x[2]+'% of topics done</div></div>'}).join('')+'</div>'},
    tasks:function(){return head(tasks.filter(function(x){return !x.d}).length+' left','Tasks')+'<div class="panel">'+taskRows(tasks)+'</div>'},
    money:function(){var tot=cats.reduce(function(a,c){return a+c[2]},0),max=Math.max.apply(null,cats.map(function(c){return c[2]}));
      return head('This week','Expenses','<span class="pill good">€'+(80-tot).toFixed(2)+' left of €80</span>')+
      '<div class="meter good" style="margin-bottom:20px"><span style="width:'+(tot/80*100)+'%"></span></div><div class="panel">'+cats.map(function(c){return '<div class="catrow"><span class="lbl"><span class="dot" style="background:'+c[1]+'"></span>'+c[0]+'</span><span class="track"><span style="width:'+(c[2]/max*100)+'%;background:'+c[1]+'"></span></span><span class="amt">€'+c[2].toFixed(2)+'</span></div>'}).join('')+
      '<div class="total-line"><span>Total</span><span class="amt">€'+tot.toFixed(2)+'</span></div></div>'}
  };
  var cur='day',view=document.getElementById('dview'),btns=document.querySelectorAll('.demo .tab');
  function show(t){cur=t;view.innerHTML=views[t]();btns.forEach(function(b){b.setAttribute('aria-selected',b.dataset.tab===t)})}
  btns.forEach(function(b){b.addEventListener('click',function(){show(b.dataset.tab)})});
  view.addEventListener('change',function(e){var i=e.target.dataset.i;if(i!=null){tasks[i].d=e.target.checked;show(cur)}});
  show('day');
})();
</script>
</body>
</html>
