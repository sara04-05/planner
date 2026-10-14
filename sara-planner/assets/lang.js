/* Language switch: English / Shqip.
   The pages are written in English; in Albanian mode every piece of text on the page is swapped for its
   translation as it appears (also text the planner draws later). What you type yourself is never changed.
   The choice is remembered in this browser. */
(function(){
const KEY='sara-lang';
let lang='en';try{lang=localStorage.getItem(KEY)==='sq'?'sq':'en'}catch(e){}
window.SPL_LANG=lang;

/* ---------- words ---------- */
const WDAY={Monday:'e hënë',Tuesday:'e martë',Wednesday:'e mërkurë',Thursday:'e enjte',Friday:'e premte',Saturday:'e shtunë',Sunday:'e diel'};
const WD3={Mon:'Hën',Tue:'Mar',Wed:'Mër',Thu:'Enj',Fri:'Pre',Sat:'Sht',Sun:'Die'};
const MONTH={January:'janar',February:'shkurt',March:'mars',April:'prill',May:'maj',June:'qershor',July:'korrik',August:'gusht',September:'shtator',October:'tetor',November:'nëntor',December:'dhjetor'};
const MON3={Jan:'Jan',Feb:'Shk',Mar:'Mar',Apr:'Pri',May:'Maj',Jun:'Qer',Jul:'Kor',Aug:'Gus',Sep:'Sht',Oct:'Tet',Nov:'Nën',Dec:'Dhj'};
const DATEW={...WDAY,...WD3,...MONTH,...MON3,Today:'Sot',Tomorrow:'Nesër',Yesterday:'Dje',Week:'Java',today:'sot'};
for(const [k,v] of Object.entries(WD3))DATEW[k.toUpperCase()]=v.toUpperCase();
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const day=s=>WDAY[s]||s, month=s=>MONTH[s]||s;
/** A string made only of dates ("Friday, 9 October", "Week 41 · 5 Oct – 11 Oct"): swap the names. */
function dateOnly(s){
  const w=s.match(/[A-Za-z]+/g);if(!w||!w.every(x=>DATEW[x]))return null;
  let first=true;
  return s.replace(/[A-Za-z]+/g,x=>{let v=DATEW[x];if(first&&/^[a-z]/.test(v)&&/^\s*$/.test(s.slice(0,s.indexOf(x))))v=cap(v);first=false;return v});
}
const TYPE={Uni:'Uni',Work:'Punë',Study:'Studim',Personal:'Personale',Health:'Shëndet',Sleep:'Gjumë',Free:'E lirë'};
const n=(k,one,many)=>+k===1?one:many;

/* ---------- whole strings ---------- */
const T={
// header, tabs, general
'Splanner':'Splanner','Dark':'Errët','Light':'Ndritshëm','Switch theme':'Ndrysho pamjen','Log out':'Dil','Users':'Përdoruesit',
'Day':'Dita','Week':'Java','Month':'Muaji','Year':'Viti','Study':'Studim','Tasks':'Detyrat','Expenses':'Shpenzimet','Planner sections':'Pjesët e planerit',
'Today':'Sot','Previous':'Para','Next':'Pas','Add':'Shto','Cancel':'Anulo','OK':'OK','Delete?':'Ta fshij?','Try again':'Provo përsëri','See all':'Shiko të gjitha','Show all':'Shfaq të gjitha',
'Loading your planner…':'Po hapet planeri…','Set up money':'Vendos paratë','Done':'Kryer',
'Start by adding your uni and work hours in Hour by hour below, and click ↻ to repeat them every week. Then set your income and savings goal in the Year tab.':'Fillo duke shtuar orët e fakultetit dhe të punës te Orë pas ore më poshtë, dhe kliko ↻ që të përsëriten çdo javë. Pastaj vendos të ardhurat dhe synimin për kursime te skeda Viti.',
// day page
'Study blocks':'Blloqet e studimit','No study blocks yet. Mark an hour as Study in Hour by hour, or add a block below.':'Ende pa blloqe studimi. Shëno një orë si Studim te Orë pas ore, ose shto një bllok më poshtë.',
'to':'deri','Add block':'Shto bllokun','All tasks →':'Të gjitha detyrat →','Nothing due on this day.':'Asgjë me afat për këtë ditë.',
'Money today':'Paratë sot','Spent':'Shpenzuar','Spent so far':'Shpenzuar deri tani','today. Set your income in the Year tab to get a daily allowance.':'sot. Vendos të ardhurat te skeda Viti për të marrë një buxhet ditor.',
'No expenses here yet.':'Ende pa shpenzime këtu.','Total for the day':'Gjithsej për ditën','Add extra study time, e.g. Calculus: series practice':'Shto kohë studimi, p.sh. Analizë: ushtrime me seri',
'What will you study?':'Çfarë do të studiosh?','Start hour':'Ora e fillimit','Start minutes':'Minutat e fillimit','End hour':'Ora e mbarimit','End minutes':'Minutat e mbarimit',
'What did you buy?':'Çfarë bleve?','Description':'Përshkrimi','Category':'Kategoria','Amount in euros':'Shuma në euro','Date':'Data',
'Food':'Ushqim','Coffee':'Kafe','Transport':'Transport','Groceries':'Pazar','School':'Shkollë','Phone':'Telefon','Fun':'Argëtim','Clothes':'Rroba','Gifts':'Dhurata','Work':'Punë','Other':'Tjetër',
'Within allowance':'Brenda buxhetit','Over daily allowance':'Mbi buxhetin ditor','Within budget':'Brenda buxhetit','Over budget':'Mbi buxhet',
// hour by hour
'Hour by hour':'Orë pas ore','Night and morning · 00–11':'Nata dhe mëngjesi · 00–11','Afternoon and evening · 12–23':'Pasditja dhe mbrëmja · 12–23',
'Type':'Lloji','Uni':'Uni','Personal':'Personale','Health':'Shëndet','Sleep':'Gjumë','Free':'E lirë','Now':'Tani',
'Set the minutes (e.g. 08:15–08:45)':'Vendos minutat (p.sh. 08:15–08:45)','Write something first, then click here to set the minutes':'Shkruaj diçka fillimisht, pastaj kliko këtu për të vendosur minutat',
'Stop repeating':'Mos e përsërit më','Lasts':'Zgjat','Starts':'Fillon','Ends':'Mbaron','1 hour':'1 orë','2 hours':'2 orë','3 hours':'3 orë',
'The start has to be before the end.':'Fillimi duhet të jetë para mbarimit.','The end time has to be after the start time.':'Ora e mbarimit duhet të jetë pas orës së fillimit.',
// import
'Import a planner':'Importo një planer','Excel, CSV, PDF or Word (.docx)':'Excel, CSV, PDF ose Word (.docx)',
'This takes a moment for big files.':'Për skedarë të mëdhenj kjo zgjat pak.',"Couldn't read that file":'Skedari nuk u lexua','Please try another file.':'Provo një skedar tjetër.',
'Please specify the hours':'Ju lutem shkruani orët',"We couldn't find any times in":'Nuk gjetëm asnjë orë në','. Write the hours next to each activity, like':'. Shkruani orët pranë çdo aktiviteti, p.sh.',
'08:00 Breakfast':'08:00 Mëngjes','or':'ose','09:15–10:45 Lecture':'09:15–10:45 Ligjërata',', then try again.':', pastaj provoni përsëri.',
'Check the types, then fill your planner. Anything already written at these times will be replaced.':'Kontrollo llojet, pastaj mbush planerin. Çdo gjë që është shkruar tashmë në këto orë do të zëvendësohet.',
'Fill:':'Mbush:','Every day (↻)':'Çdo ditë (↻)','Monday to Friday (↻)':'E hënë deri e premte (↻)','Every week (↻)':'Çdo javë (↻)','Fill my planner':'Mbush planerin','Which days to fill':'Cilat ditë të mbushen',
"Old .doc files can't be read. In Word, use File > Save As > Word Document (.docx), then try again.":'Skedarët e vjetër .doc nuk lexohen. Në Word zgjidh File > Save As > Word Document (.docx), pastaj provo përsëri.',
'Pick an Excel, CSV, PDF or Word (.docx) file.':'Zgjidh një skedar Excel, CSV, PDF ose Word (.docx).',"Couldn't load the file reader. Check your internet connection and try again.":'Lexuesi i skedarit nuk u ngarkua. Kontrollo internetin dhe provo përsëri.',
'Nothing to import.':'Asgjë për të importuar.','That file has too many entries. Import a week at a time.':'Skedari ka shumë rreshta. Importo një javë në një kohë.','Two entries in the file overlap.':'Dy aktivitete në skedar mbivendosen.',
'Two entries share one hour. Reload the page and try again.':'Dy aktivitete ndajnë të njëjtën orë. Rifresko faqen dhe provo përsëri.','Repeat every week only works for one week at a time.':'Përsëritja çdo javë punon vetëm për një javë në një kohë.',
// import examples
'What should my file look like?':'Si duhet të duket skedari im?','How your file should look':'Si duhet të duket skedari',
'Any of these works. Each activity needs a time next to it, in the same row or line.':'Secila nga këto funksionon. Çdo aktivitet duhet të ketë një orë pranë tij, në të njëjtin rresht.',
'Excel or CSV: one row per activity':'Excel ose CSV: një rresht për çdo aktivitet','Excel or Word: a weekly timetable':'Excel ose Word: orar javor','PDF, Word or text: one line per activity':'PDF, Word ose tekst: një rresht për çdo aktivitet',
'Time':'Ora','Start':'Fillon','End':'Mbaron','Activity':'Aktiviteti','Breakfast':'Mëngjes','Lecture':'Ligjërata','Gym':'Palestër','Lunch':'Drekë','Study':'Studim','Work shift':'Ndërrimi në punë',
'A time on its own (08:00) lasts until the next activity. A range (08:15–09:45) sets both ends. Days can be columns or headings like':'Një orë e vetme (08:00) zgjat deri te aktiviteti tjetër. Një interval (08:15–09:45) cakton fillimin dhe mbarimin. Ditët mund të jenë kolona ose tituj si',
'Times can be written in English or Albanian, for example 8:30, 8 am, ora 8, 8 e gjysmë or 3 pasdite.':'Orët mund të shkruhen shqip ose anglisht, p.sh. 8:30, 8 am, ora 8, 8 e gjysmë ose 3 pasdite.',
'Got it':'Në rregull','Download an example as:':'Shkarko një shembull si:',"Couldn't load the file writer. Check your internet connection and try again.":'Shkruesi i skedarit nuk u ngarkua. Kontrollo internetin dhe provo përsëri.',"Couldn't create the example":'Shembulli nuk u krijua','Please try another format.':'Provo një format tjetër.',
'Bring in a planner you already have, or show these hours in Google Calendar.':'Sill një planer që e ke tashmë, ose shfaqi këto orë në Google Calendar.',
'Already have your day planned in Excel, a PDF or Word? Bring it in.':'E ke ditën të planifikuar në Excel, PDF ose Word? Sille këtu.',
// google calendar
'Show in Google Calendar':'Shfaq në Google Calendar','Want these hours in your Google Calendar too?':'I do këto orë edhe në Google Calendar?','Sync now':'Sinkronizo tani','Disconnect':'Shkëput',
"Stop sending hours to Google. What's already there stays until you delete the Splanner calendar.":'Ndalo dërgimin e orëve te Google. Ato që janë atje mbeten derisa ta fshish kalendarin Splanner.',
'Sending to Google Calendar…':'Po dërgohet në Google Calendar…','Up to date in Google Calendar ✓':'I përditësuar në Google Calendar ✓',"Couldn't reach Google Calendar":'Google Calendar nuk u arrit',
'Google Calendar is connected. Your hours are on their way to the "Splanner" calendar.':'Google Calendar u lidh. Orët tuaja po dërgohen te kalendari "Splanner".',
"Google Calendar is disconnected. You can delete the \"Splanner\" calendar in Google if you don't need it.":'Google Calendar u shkëput. Mund ta fshish kalendarin "Splanner" në Google nëse nuk të duhet.',
'Google Calendar was not connected.':'Google Calendar nuk u lidh.',"Please tick the calendar box on Google's page so the planner can add your hours.":'Ju lutem shënoni kutinë e kalendarit në faqen e Google që planeri të shtojë orët.',
'Google Calendar is not set up on this site yet.':'Google Calendar ende nuk është konfiguruar në këtë faqe.',"Couldn't connect Google Calendar. Please try again.":'Google Calendar nuk u lidh. Provo përsëri.',
'Google Calendar is not connected.':'Google Calendar nuk është i lidhur.','Google Calendar was disconnected. Connect it again to keep syncing.':'Google Calendar u shkëput. Lidhe përsëri për të vazhduar sinkronizimin.',
"Google didn't accept the login. Try again in a minute.":'Google nuk e pranoi hyrjen. Provo përsëri pas një minute.',"Couldn't create the Splanner calendar in Google.":'Kalendari Splanner nuk u krijua në Google.',
// week, month, year
'Spending this week':'Shpenzimet këtë javë','Nothing spent in this period.':'Asgjë e shpenzuar në këtë periudhë.','Week total':'Gjithsej java','Add an expense':'Shto një shpenzim',
'This month':'Ky muaj','Task due':'Detyrë me afat','High-priority task':'Detyrë me përparësi të lartë','€ red':'€ e kuqe',
'Money this month':'Paratë këtë muaj','Income':'Të ardhurat','Spending allowance':'Buxheti për shpenzime','Savings target':'Synimi për kursime','Left to save':'Mbetet për t\'u kursyer',
"Couldn't save that much? Change the target.":'Nuk kursove aq? Ndrysho synimin.','Month total':'Gjithsej muaji',
'Year overview':'Përmbledhja e vitit','Savings plan':'Plani i kursimeve','Usual monthly income':'Të ardhurat e zakonshme mujore','Save this month':'Kurse këtë muaj','/ month':'/ muaj',
'Spending by month':'Shpenzimet sipas muajve','from your daily expenses':'nga shpenzimet ditore','Upcoming':'Në vazhdim','No income':'Pa të ardhura','No income this month':'Pa të ardhura këtë muaj','Savings':'Kursimet','Left over':'Mbetur','I saved':'Kurseva','Nothing left to save':'Asgjë më për t\'u kursyer','Year expenses':'Shpenzimet e vitit',
'Spending adds up from your daily expenses · click an income to change it for that month':'Shpenzimet mblidhen nga shpenzimet ditore · kliko të ardhurat për t\'i ndryshuar për atë muaj',
'Saved':'Kursyer','Target':'Synimi','Status':'Gjendja','On target':'Në synim','In progress':'Në vazhdim','Where the money went':'Ku shkuan paratë',
'Enter your monthly income and savings goal above. The planner then works out how much to save each month and your daily spending allowance.':'Shkruaj më lart të ardhurat mujore dhe synimin për kursime. Planeri llogarit sa të kursesh çdo muaj dhe buxhetin ditor për shpenzime.',
'Clear to use your usual income':'Fshije për të përdorur të ardhurat e zakonshme','Go back to the automatic amount':'Kthehu te shuma automatike','You changed this in the Month tab':'E ndryshove këtë te skeda Muaji',
'Weekly allowance':'Buxheti javor','Monthly totals':'Totalet mujore','auto-summed':'mbledhur automatikisht',
// study
'Study planner':'Planeri i studimit','Subject':'Lënda','Topic':'Tema','Revised':'Përsëritur','Priority':'Përparësia','Revised so far':'Përsëritur deri tani',"Today's study blocks":'Blloqet e studimit sot',
'Coming up':'Së shpejti','No deadlines yet. Add one below, or give a subject an exam date.':'Ende pa afate. Shto një më poshtë, ose vendos datën e provimit për një lëndë.','Tiny steps still count.':'Edhe hapat e vegjël kanë rëndësi.',
'Subjects and chapters':'Lëndët dhe kapitujt','Add subject':'Shto lëndën','No subjects yet. Add your first one above.':'Ende pa lëndë. Shto të parën më lart.','Change priority':'Ndrysho përparësinë',
'+ Add a deadline':'+ Shto një afat','Deadline':'Afati','Deadline date':'Data e afatit','Add a subject, e.g. Linear Algebra':'Shto një lëndë, p.sh. Algjebër lineare','Subject name':'Emri i lëndës','Exam date (optional)':'Data e provimit (opsionale)',
'No exam date':'Pa datë provimi','Where to find this chapter (book, author, literature)':'Ku gjendet ky kapitull (libri, autori, literatura)',
// tasks, expenses
'High':'E lartë','Medium':'Mesatare','Low':'E ulët','Add task':'Shto detyrën','Open':'Të hapura','This week':'Këtë javë','Overdue':'Me vonesë','All':'Të gjitha','No tasks in this view.':'Asnjë detyrë këtu.',
'Low priority':'Përparësi e ulët','Medium priority':'Përparësi mesatare','High priority':'Përparësi e lartë','Add a task…':'Shto një detyrë…','Task':'Detyra','Due date':'Afati','Tag':'Etiketa','Due today':'Me afat sot',
'Total spent':'Gjithsej shpenzuar','Per day':'Në ditë','Allowance':'Buxheti','for this month':'për këtë muaj','for this day':'për këtë ditë','for this week':'për këtë javë','for this year':'për këtë vit',
'Left':'Mbetur','No expenses in this period.':'Asnjë shpenzim në këtë periudhë.','By category':'Sipas kategorisë','Total':'Gjithsej','Period':'Periudha','Whole year':'I gjithë viti',
// server messages
'Please log in again.':'Ju lutem hyni përsëri.','Something went wrong. Try again.':'Diçka shkoi keq. Provo përsëri.','That date is not valid.':'Kjo datë nuk është e vlefshme.','That time is not valid.':'Kjo orë nuk është e vlefshme.',
'Your session expired. Reload the page.':'Sesioni skadoi. Rifresko faqen.','Confirm your email first. Reload the page.':'Konfirmo email-in fillimisht. Rifresko faqen.',
'Subject not found.':'Lënda nuk u gjet.','Chapter not found.':'Kapitulli nuk u gjet.','Topic not found.':'Tema nuk u gjet.','That amount is not valid.':'Kjo shumë nuk është e vlefshme.','Enter an amount above zero.':'Shkruaj një shumë mbi zero.',
'That overlaps the hour before.':'Kjo mbivendoset me orën para.','That hour is empty.':'Kjo orë është bosh.','The next entry starts before that. Pick an earlier end.':'Aktiviteti tjetër fillon para kësaj. Zgjidh një mbarim më të hershëm.',
'Could not save to the database. Is MySQL running?':'Nuk u ruajt në bazën e të dhënave. A po punon MySQL?',
// login, register, verify, admin
'Welcome back':'Mirë se u ktheve','Log in to open your planner.':'Hyr për të hapur planerin.','Email':'Email','Password':'Fjalëkalimi','Log in':'Hyr','New here?':'I ri këtu?','Create an account':'Krijo një llogari',
'Create your planner':'Krijo planerin tënd','Your planner is private. Only you can see what you add.':'Planeri yt është privat. Vetëm ti sheh çfarë shton.',"We'll email you a code to check your email is right.":'Do të të dërgojmë një kod me email për të kontrolluar që email-i është i saktë.',
'Name':'Emri','Repeat password':'Përsërit fjalëkalimin','Create account':'Krijo llogarinë','Already have an account?':'Ke tashmë një llogari?',
"That email and password don't match an account.":'Ky email dhe fjalëkalim nuk përputhen me asnjë llogari.','Enter your name (up to 80 characters).':'Shkruaj emrin (deri në 80 shkronja).','Enter a valid email address.':'Shkruaj një adresë email të vlefshme.',
'Your password needs at least 8 characters.':'Fjalëkalimi duhet të ketë të paktën 8 shkronja.','There is already an account with that email. Log in instead.':'Ekziston tashmë një llogari me këtë email. Hyr në vend të kësaj.',"The two passwords don't match.":'Dy fjalëkalimet nuk përputhen.',
'Check your email':'Kontrollo email-in','We sent a 6-digit code to':'Dërguam një kod me 6 shifra te','. Type it below to open your planner.':'. Shkruaje më poshtë për të hapur planerin.','Type it below to open your planner.':'Shkruaje më poshtë për të hapur planerin.',
'It can take a minute, and sometimes lands in Spam.':'Mund të zgjasë një minutë, dhe ndonjëherë përfundon te Spam.','Code':'Kodi','Confirm email':'Konfirmo email-in',"Didn't get it?":'Nuk të erdhi?','Send a new code':'Dërgo një kod të ri',
'Wrong email? Change it':'Email i gabuar? Ndryshoje','Your email':'Email-i yt','Save and send the code there':'Ruaje dhe dërgo kodin atje','Your session expired. Please try again.':'Sesioni skadoi. Provo përsëri.',
'That code has run out. Click "Send a new code".':'Kodi ka skaduar. Kliko "Dërgo një kod të ri".','Too many wrong codes. Click "Send a new code".':'Shumë kode të gabuara. Kliko "Dërgo një kod të ri".',
'Please wait a minute before asking for another code.':'Prit një minutë para se të kërkosh kod tjetër.','There is already an account with that email.':'Ekziston tashmë një llogari me këtë email.',
"That code isn't right. Check the latest email we sent.":'Kodi nuk është i saktë. Kontrollo email-in e fundit që dërguam.','Not allowed':'Nuk lejohet','This page is only for the site owner.':'Kjo faqe është vetëm për pronarin e faqes.',
'Back to your planner':'Kthehu te planeri','Back to planner':'Kthehu te planeri','Signed up':'Regjistruar','Last login':'Hyrja e fundit','account':'llogari','accounts':'llogari','in this database.':'në këtë bazë të dhënash.',
'Log in · Splanner':'Hyr · Splanner','Create an account · Splanner':'Krijo një llogari · Splanner','Confirm your email · Splanner':'Konfirmo email-in · Splanner','Users · Splanner':'Përdoruesit · Splanner',
// welcome page
'Features':'Veçoritë','Is it safe?':'A është e sigurt?','FAQ':'Pyetje','Create free account':'Krijo llogari falas','Free student planner · no ads':'Planer falas për studentë · pa reklama',
'Your studies, tasks and money in one notebook.':'Studimet, detyrat dhe paratë në një fletore.',
'Plan your day hour by hour, count down to exams, tick off chapters and see exactly where your money goes each week. Try it right here before you sign up.':'Planifiko ditën orë pas ore, numëro ditët deri te provimet, shëno kapitujt e kryer dhe shih saktë ku shkojnë paratë çdo javë. Provoje këtu para se të regjistrohesh.',
'Try the live preview':'Provo shembullin','No ads or tracking':'Pa reklama dhe gjurmim','Only your email is needed':'Duhet vetëm email-i','Delete your data anytime':'Fshi të dhënat kur të duash','Live preview · sample data':'Shembull · të dhëna provë',
'3 study hours':'3 orë studim','Class':'Mësim','Algorithms lecture':'Ligjërata e algoritmeve','Databases, ch. 4':'Bazat e të dhënave, kap. 4','Lunch with Ana':'Drekë me Anën','OOP lab report':'Raporti i laboratorit OOP','Café shift':'Ndërrim në kafene',
'Finish OOP lab report':'Përfundo raportin e laboratorit OOP','Read chapter 4, Databases':'Lexo kapitullin 4, Bazat e të dhënave','Note to self':'Shënim për veten','Exam in 9 days, you got this!':'Provimi pas 9 ditësh, do t\'ia dalësh!',
"Click the tabs. Tick a task. Nothing here is saved, it's just a preview.":'Kliko skedat. Shëno një detyrë. Asgjë nuk ruhet këtu, është vetëm shembull.','Seven pages, one planner':'Shtatë faqe, një planer',
'Each tab is a page in the notebook. Use the ones you need and ignore the rest.':'Çdo skedë është një faqe e fletores. Përdor ato që të duhen dhe injoro të tjerat.',
"An hour-by-hour plan with study, class, work and free-time blocks, plus today's tasks and spending.":'Plan orë pas ore me blloqe për studim, mësim, punë dhe kohë të lirë, si dhe detyrat dhe shpenzimet e ditës.',
'All seven days side by side, so you can see busy days coming before they arrive.':'Të shtatë ditët krah për krah, që t\'i shohësh ditët e ngarkuara para se të vijnë.',
'A calendar with how much you spent each day and which days have deadlines.':'Kalendar me sa shpenzove çdo ditë dhe cilat ditë kanë afate.',"Month-by-month totals and how much you've managed to save.":'Totalet muaj pas muaji dhe sa ke arritur të kursesh.',
'Subjects split into chapters and topics, with exam countdowns and progress bars.':'Lëndët të ndara në kapituj dhe tema, me numërim deri te provimet dhe shirita përparimi.',
'To-dos with due dates and priorities, grouped into overdue, today and later.':'Detyra me afate dhe përparësi, të grupuara në me vonesë, sot dhe më vonë.',
'Log what you spend in seconds, set a weekly budget and see it by category.':'Shëno shpenzimet në sekonda, vendos buxhetin javor dhe shihe sipas kategorive.','How it works':'Si funksionon',
'Just a name, email and password. No phone number, no card, no social login.':'Vetëm emër, email dhe fjalëkalim. Pa numër telefoni, pa kartë, pa hyrje me rrjete sociale.','Fill in your notebook':'Mbush fletoren',
'Add your subjects, exam dates and weekly budget. It takes about two minutes.':'Shto lëndët, datat e provimeve dhe buxhetin javor. Zgjat rreth dy minuta.','Open it every morning':'Hape çdo mëngjes',
'Everything saves as you type, and it works on your phone and laptop.':'Çdo gjë ruhet ndërsa shkruan, dhe punon në telefon dhe laptop.','Why is there a login, and is it safe?':'Pse duhet hyrja, dhe a është e sigurt?',
'The login is only there so your planner stays private to you. Here is exactly what happens to your information.':'Hyrja ekziston vetëm që planeri të mbetet privat për ty. Ja saktësisht çfarë ndodh me të dhënat e tua.',
'What we do':'Çfarë bëjmë','Store your password scrambled':'E ruajmë fjalëkalimin të koduar',"It's hashed, so not even the site owner can read it.":'Është i koduar, kështu që as pronari i faqes nuk mund ta lexojë.',
'Keep your planner private':'E mbajmë planerin privat','Every save is tied to your account. No one else can see it.':'Çdo ruajtje lidhet me llogarinë tënde. Askush tjetër nuk mund ta shohë.',
'Use a secure connection':'Përdorim lidhje të sigurt','Look for the padlock in the address bar.':'Shiko drynin në shiritin e adresës.','Let you leave anytime':'Mund të largohesh kur të duash',
'Delete your account and all your data is gone.':'Fshi llogarinë dhe të gjitha të dhënat zhduken.','What we never do':'Çfarë nuk bëjmë kurrë','Ask for your university or email password':'Kërkojmë fjalëkalimin e fakultetit ose të email-it',
'Make a new password just for this site.':'Krijo një fjalëkalim të ri vetëm për këtë faqe.','Ask for card or bank details':'Kërkojmë të dhëna karte ose banke','The expense tracker is just numbers you type in.':'Shpenzimet janë vetëm numra që i shkruan vetë.',
'Show ads or sell your data':'Shfaqim reklama ose shesim të dhënat','Your data is used only to run your planner.':'Të dhënat përdoren vetëm që të punojë planeri.',"Send you emails you didn't ask for":'Dërgojmë email-e që nuk i kërkove',
'Your email is only used to log in.':'Email-i përdoret vetëm për hyrje.','Questions':'Pyetje','Is it free?':'A është falas?','Yes, completely. There is no paid version.':'Po, plotësisht. Nuk ka version me pagesë.',
'Can I use it on my phone?':'A mund ta përdor në telefon?','Yes. The notebook tabs move to the top on small screens.':'Po. Skedat e fletores kalojnë sipër në ekranet e vogla.','Do I need to install anything?':'A duhet të instaloj diçka?',
'No. It runs in your browser, so you just log in from any phone or computer.':'Jo. Punon në shfletues, kështu që thjesht hyn nga çdo telefon ose kompjuter.','Will I lose my plans if I switch devices?':'A i humbas planet nëse ndërroj pajisjen?',
"No. Everything is saved to your account as you type, so you'll find the same notebook on your phone and your laptop.":'Jo. Çdo gjë ruhet në llogari ndërsa shkruan, kështu që e gjen të njëjtën fletore në telefon dhe laptop.',
'Does it connect to my bank?':'A lidhet me bankën time?','No. You type in what you spend yourself. The planner never sees your bank account or card.':'Jo. Shpenzimet i shkruan vetë. Planeri nuk e sheh kurrë llogarinë bankare apo kartën.',
'What currency does it use?':'Çfarë monedhe përdor?','Amounts are shown in euros (€).':'Shumat shfaqen në euro (€).','Is there a dark mode?':'A ka modalitet të errët?',
'Yes. It follows your device setting, and you can switch it with one button at the top of the planner.':'Po. Ndjek cilësimin e pajisjes, dhe mund ta ndryshosh me një buton në krye të planerit.','Can other people see my planner?':'A mund ta shohin të tjerët planerin tim?',
"No. Your planner is only visible when you're logged in to your own account.":'Jo. Planeri shihet vetëm kur je i kyçur në llogarinë tënde.','Ready to plan your week?':'Gati ta planifikosh javën?','It takes under a minute to set up.':'Krijohet për më pak se një minutë.',
'People':'Njerëzit','Edit profile':'Ndrysho profilin','No bio yet.':'Ende pa bio.','Friend requests':'Kërkesat për miqësi','Accept':'Prano','Decline':'Refuzo',
'Your friends':'Miqtë e tu',"Open a notebook to see that friend's plan for today.":'Hap një fletore për të parë planin e sotëm të atij shoku.','Add a friend':'Shto një shok','Find people':'Gjej njerëz',
'Name or email':'Emri ose email-i','Search':'Kërko','Nobody found. Check the spelling, or search by their email.':'Nuk u gjet askush. Kontrollo drejtshkrimin, ose kërko me email-in e tyre.',
'Friends ✓':'Miq ✓','Requested · cancel':'Kërkuar · anulo','Add friend':'Shto shok','Your profile':'Profili yt','Back to people':'Kthehu te njerëzit','← People':'← Njerëzit',
'This is what your friends see. They can also see your hour-by-hour plan for today, nothing else.':'Kjo është ajo që shohin miqtë e tu. Ata shohin edhe planin tënd orë pas ore për sot, asgjë tjetër.',
'Saved.':'U ruajt.','Profile picture':'Fotoja e profilit','Remove my picture':'Hiq foton time','Name (your username)':'Emri (emri yt i përdoruesit)','Bio':'Bio','A few words about you':'Disa fjalë për ty',
'Notebook cover':'Kopertina e fletores','Wildflowers':'Lule të egra','Cherries & bows':'Qershi dhe fjongo','Autumn leaves':'Gjethe vjeshte','Woodland':'Pyll','Pressed ferns':'Fier të thara','Rose vine':'Trëndafila',
'Blush':'Rozë e butë','Pink bow':'Fjongo rozë','Rosewood':'Rozë e errët','White & bow':'E bardhë me fjongo','Nude':'Bezhë','Words on a spiral cover':'Fjalë në kopertinën me spirale','e.g. she is fearless':'p.sh. ajo është e guximshme',
'Shown in handwriting on the pink spiral covers. Leave it empty to show your name.':'Shfaqen me shkrim dore në kopertinat rozë me spirale. Lëre bosh për të shfaqur emrin tënd.','Save profile':'Ruaj profilin',
'That picture is too big. Pick one under 5 MB.':'Fotoja është shumë e madhe. Zgjidh një nën 5 MB.','That picture is too big. Pick one under 600 KB.':'Fotoja është shumë e madhe. Zgjidh një nën 600 KB.',
'The picture could not be uploaded. Try again.':'Fotoja nuk u ngarkua. Provo përsëri.','Pick a JPG, PNG, WebP or GIF picture.':'Zgjidh një foto JPG, PNG, WebP ose GIF.','Please fill in your name.':'Ju lutem shkruani emrin.',
'Your session expired. Please try again.':'Seanca skadoi. Provo përsëri.','Not friends':'Jo miq','Not friends yet':'Ende jo miq',
"You can see someone's day once you're friends. Send them a friend request on the People page.":'Ditën e dikujt e sheh pasi të bëheni miq. Dërgoji një kërkesë për miqësi te faqja Njerëzit.','Go to People':'Shko te Njerëzit',
'Nothing planned today.':'Asgjë e planifikuar sot.','Remove from friends':'Hiq nga miqtë',
'Chat':'Bisedë','Messages':'Mesazhet','Write to someone':'Shkruaji dikujt','Their email':'Email-i i tyre','Open':'Hap','Send':'Dërgo','Message':'Mesazhi','Write a message…':'Shkruaj një mesazh…','You:':'Ti:','Loading…':'Po hapet…',
"No messages yet. Type someone's email above to start.":'Ende pa mesazhe. Shkruaj email-in e dikujt më lart për të filluar.',"Pick a conversation, or start one with someone's email.":'Zgjidh një bisedë, ose fillo një me email-in e dikujt.',
'Say hi! Your messages are only seen by the two of you.':'Përshëndeti! Mesazhet i shihni vetëm ju të dy.','Nobody has a Splanner account with that email.':'Askush nuk ka llogari Splanner me këtë email.',
"That's your own email.":'Ky është email-i yt.',"You can't message yourself.":'Nuk mund t\'i shkruash vetes.','That account no longer exists.':'Kjo llogari nuk ekziston më.',
'You are sending messages too fast. Wait a minute and try again.':'Po dërgon mesazhe shumë shpejt. Prit një minutë dhe provo përsëri.','Something went wrong. Try again.':'Diçka shkoi keq. Provo përsëri.',
'I already have one':'E kam një','Privacy':'Privatësia','Main':'Kryesore','Preview sections':'Pjesët e shembullit','Splanner · Study, tasks & money in one notebook':'Splanner · Studime, detyra dhe para në një fletore','Splanner':'Splanner',
};

/* ---------- strings with names, numbers or dates in them ---------- */
const P=[
 [/^Remove (.+) from your friends\?$/,(m,a)=>`Ta heq ${a} nga miqtë?`],
 [/^Someone else is also called (.+), so people see your email under your name to tell you apart\.$/,(m,a)=>`Edhe dikush tjetër quhet ${a}, prandaj njerëzit shohin email-in tënd nën emër për t'ju dalluar.`],
 [/^Hi, (.+)$/,(m,a)=>`Përshëndetje, ${a}`],
 [/^Welcome, (.+)!$/,(m,a)=>`Mirë se erdhe, ${a}!`],
 [/^(\d+) of (\d+) done$/,(m,a,b)=>`${a} nga ${b} të kryera`],
 [/^of (\d+) done$/,(m,a)=>`nga ${a} të kryera`],
 [/^(\d+) of (\d+) things learned$/,(m,a,b)=>`${a} nga ${b} gjëra të mësuara`],
 [/^of (\d+) things learned$/,(m,a)=>`nga ${a} gjëra të mësuara`],
 [/^(\d+)h of (\d+)h$/,(m,a,b)=>`${a}h nga ${b}h`],
 [/^Free from (.+)$/,(m,a)=>`E lirë nga ${a}`],
 [/^Free today:$/,()=>'E lirë sot:'],
 [/^Free on (.+):$/,(m,a)=>`E lirë më ${tr(a)}:`],
 [/^no free hours left$/,()=>'nuk ka më orë të lira'],
 [/^(Uni|Work|Study|Personal|Health|Sleep|Free) (\d+)h$/,(m,a,b)=>`${TYPE[a]} ${b}h`],
 [/^(\d\d:\d\d(?:–\d\d:\d\d)?)\. (.+)$/,(m,a,b)=>`${a}. ${tr(b)}`],
 [/^Type for (.+)$/,(m,a)=>`Lloji për ${a}`],
 [/^Plan for (.+)$/,(m,a)=>`Plani për ${a}`],
 [/^Delete (.+)$/,(m,a)=>`Fshi ${a}`],
 [/^Done: (.+)$/,(m,a)=>`Kryer: ${a}`],
 [/^Learned: (.+)$/,(m,a)=>`Mësuar: ${a}`],
 [/^Edit (.+)$/,(m,a)=>`Ndrysho ${a}`],
 [/^New name for (.+)$/,(m,a)=>`Emri i ri për ${a}`],
 [/^Where to find (.+)$/,(m,a)=>`Ku gjendet ${a}`],
 [/^Add something to learn in (.+)$/,(m,a)=>`Shto diçka për të mësuar te ${a}`],
 [/^Add a chapter to (.+)$/,(m,a)=>`Shto një kapitull te ${a}`],
 [/^Use (\d\d:\d\d–\d\d:\d\d)$/,(m,a)=>`Përdor ${a}`],
 [/^Savings target for (\w+)$/,(m,a)=>`Synimi për kursime për ${month(a)}`],
 [/^Income for (\w+)$/,(m,a)=>`Të ardhurat për ${month(a)}`],
 [/^Savings goal for (\d+)$/,(m,a)=>`Synimi për kursime për ${a}`],
 [/^Total (\d{4})$/,(m,a)=>`Gjithsej ${a}`],
 [/^(Subject|Topic|Hours) for (\w+)$/,(m,a,b)=>`${{Subject:'Lënda',Topic:'Tema',Hours:'Orët'}[a]} për ${day(b)}`],
 [/^Revised on (\w+)$/,(m,a)=>`Përsëritur të ${day(a)}`],
 [/^Repeat every (\w+)$/,(m,a)=>`Përsërite çdo ${day(a).replace(/^e /,'të ')}`],
 [/^Click to repeat every (\w+)$/,(m,a)=>`Kliko për ta përsëritur çdo ${day(a).replace(/^e /,'të ')}`],
 [/^Repeats every (\w+)\. Click to keep it on this day only\.$/,(m,a)=>`Përsëritet çdo ${day(a).replace(/^e /,'të ')}. Kliko për ta mbajtur vetëm në këtë ditë.`],
 [/^Write your uni, work and everything else for each hour, and pick a type to colour it\. Click a time to set when it starts and ends, like 17:15–19:45\. Click ↻ to repeat an hour every (\w+), so your weekly timetable fills itself in\.$/,
  (m,a)=>`Shkruaj fakultetin, punën dhe çdo gjë tjetër për çdo orë, dhe zgjidh një lloj për ta ngjyrosur. Kliko një orë për të vendosur kur fillon dhe mbaron, p.sh. 17:15–19:45. Kliko ↻ për ta përsëritur një orë çdo ${day(a).replace(/^e /,'të ')}, që orari javor të mbushet vetë.`],
 [/^(.+?) · ↻ every (\w+)$/,(m,a,b)=>`${tr(a)} · ↻ çdo ${day(b).replace(/^e /,'të ')}`],
 [/^(\d\d:\d\d) · (.+)$/,(m,a,b)=>`${a} · ${b}`],
 [/^Reading (.+)…$/,(m,a)=>`Po lexohet ${a}…`],
 [/^Found (\d+) (?:entry|entries)(?: for (\d+) days)?$/,(m,a,b)=>`U gjetën ${a} ${n(a,'aktivitet','aktivitete')}${b?` për ${b} ditë`:''}`],
 [/^Only the week of (.+)$/,(m,a)=>`Vetëm java e ${tr(a)}`],
 [/^Only (.+)$/,(m,a)=>`Vetëm ${tr(a)}`],
 [/^Filled in (\d+) (?:entry|entries) from your file(?: (on every day|on Monday to Friday|every week))?\.$/,(m,a,b)=>`U plotësuan ${a} ${n(a,'aktivitet','aktivitete')} nga skedari${b?' '+{'on every day':'për çdo ditë','on Monday to Friday':'nga e hëna deri të premten','every week':'çdo javë'}[b]:''}.`],
 [/^(\d+) months? left$/,(m,a)=>`${a} ${n(a,'muaj','muaj')} të mbetur`],
 [/^months? left$/,()=>'muaj të mbetur'],
 [/^(\d+) expenses?$/,(m,a)=>`${a} ${n(a,'shpenzim','shpenzime')}`],
 [/^average over (\d+) days?$/,(m,a)=>`mesatarja për ${a} ${n(a,'ditë','ditë')}`],
 [/^(\d+)% of allowance used$/,(m,a)=>`${a}% e buxhetit e përdorur`],
 [/^(\d+) open · (\d+) due today · (\d+) overdue$/,(m,a,b,c)=>`${a} të hapura · ${b} me afat sot · ${c} me vonesë`],
 [/^(\w{3}): (€.+)$/,(m,a,b)=>`${DATEW[a]||a}: ${b}`],
 [/^Weekly allowance (€.+)$/,(m,a)=>`Buxheti javor ${a}`],
 [/^= over daily allowance \((.+)\)$/,(m,a)=>`= mbi buxhetin ditor (${a})`],
 [/^of your daily allowance of (.+)\.$/,(m,a)=>`nga buxheti ditor prej ${a}.`],
 [/^The difference is split evenly over the months after (\w+)\.$/,(m,a)=>`Diferenca ndahet njësoj në muajt pas ${month(a)}.`],
 [/^Couldn't save that much\? Change the target\. The difference is split evenly over the months after (\w+)\.$/,(m,a)=>`Nuk kursove aq? Ndrysho synimin. Diferenca ndahet njësoj në muajt pas ${month(a)}.`],
 [/^to reach (.+) by December\. That leaves$/,(m,a)=>`për të arritur ${a} deri në dhjetor. Kjo lë`],
 [/^for spending in (\w+)\. The even split would be (.+) a month\.$/,(m,a,b)=>`për shpenzime në ${month(a)}. Ndarja e barabartë do të ishte ${b} në muaj.`],
 [/^saved so far \(confirmed\) · (.+) of goal$/,(m,a)=>`kursyer deri tani (konfirmuar) · ${a} e synimit`],
 [/^Confirm · (.+) to catch up$/,(m,a)=>`Konfirmo · ${a} për t'u arritur`],
 [/^Next to save · (\w+)$/,(m,a)=>`Radha për t'u kursyer · ${month(a)}`],
 [/^Short (.+)$/,(m,a)=>`Mungojnë ${a}`],
 [/^See all (\d+) in Expenses →$/,(m,a)=>`Shiko të ${a} te Shpenzimet →`],
 [/^Show all (\d+) days$/,(m,a)=>`Shfaq të ${a} ditët`],
 [/^Exam (.+) · (\d+) days?$/,(m,a,b)=>`Provimi ${tr(a)} · ${b} ${n(b,'ditë','ditë')}`],
 [/^Exam was (.+)$/,(m,a)=>`Provimi ishte ${tr(a)}`],
 [/^(\d+) of (\d+) learned · (\d+) chapters?$/,(m,a,b,c)=>`${a} nga ${b} të mësuara · ${c} ${n(c,'kapitull','kapituj')}`],
 [/^of (\d+) learned · (\d+) chapters?$/,(m,a,b)=>`nga ${a} të mësuara · ${b} ${n(b,'kapitull','kapituj')}`],
 [/^Added (.+), (\d\d:\d\d–\d\d:\d\d) on (.+)\. It's in Hour by hour too\.$/,(m,a,b,c)=>`U shtua ${a}, ${b} më ${tr(c)}. Është edhe te Orë pas ore.`],
 [/^That time is already taken \((.+)\)\. Pick one of the free times below\.$/,(m,a)=>`Kjo orë është e zënë (${a}). Zgjidh një nga orët e lira më poshtë.`],
 [/^(\d\d:\d\d) is already taken \((.+)\)\. Clear it first or pick an earlier end\.$/,(m,a,b)=>`${a} është e zënë (${b}). Pastroje fillimisht ose zgjidh një mbarim më të hershëm.`],
 [/^(\d\d:\d\d) is already taken\. (.+)$/,(m,a,b)=>`${a} është e zënë. ${tr(b)}`],
 [/^Clear it first or pick an earlier end\.$/,()=>'Pastroje fillimisht ose zgjidh një mbarim më të hershëm.'],
 [/^Pick a free time\.$/,()=>'Zgjidh një orë të lirë.'],
 [/^(.+) starts at (\d\d:\d\d)\. Pick an earlier end\.$/,(m,a,b)=>`${a} fillon në ${b}. Zgjidh një mbarim më të hershëm.`],
 [/^Couldn't load your planner: (.+)$/,(m,a)=>`Planeri nuk u hap: ${tr(a)}`],
 [/^In Google Calendar(?: \((.+)\))?, in the calendar called$/,(m,a)=>`Në Google Calendar${a?` (${a})`:''}, në kalendarin me emrin`],
 [/^We sent a new code to (.+)\.$/,(m,a)=>`Dërguam një kod të ri te ${a}.`],
 [/^Please fill in the (.+)\.$/,(m,a)=>`Ju lutem plotësoni: ${tr(a)}.`],
 [/^(\d+) (?:entry|entries)$/,(m,a)=>`${a} ${n(a,'aktivitet','aktivitete')}`],
 [/^(\d+) day(s?)$/,(m,a)=>`${a} ditë`],
 [/^(\d+) min$/,(m,a)=>`${a} min`],
];

const cache=new Map();
function tr(s){
  if(lang!=='sq'||!s)return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s),core=m[2];
  if(!core||!/[A-Za-z]/.test(core))return s;
  if(cache.has(core))return m[1]+cache.get(core)+m[3];
  let out=T[core];
  if(out==null)for(const [re,f] of P){const x=re.exec(core);if(x){out=f(...x);break}}
  if(out==null)out=dateOnly(core);
  if(out==null)out=core;
  cache.set(core,out);
  return m[1]+out+m[3];
}
window.SPL_T=tr;
if(lang!=='sq'){wireButtons();return}

document.documentElement.lang='sq';
const ATTRS=['placeholder','title','aria-label'];
const skip=el=>!el||el.closest('script,style,textarea,[translate=no]');
function doText(node){
  const p=node.parentElement;if(!p||skip(p))return;
  const v=node.nodeValue,t=tr(v);if(t!==v)node.nodeValue=t;
}
function doEl(el){
  if(el.closest('script,style,[translate=no]'))return;   // a box's own hint text (placeholder) is translated, what's typed in it isn't
  for(const a of ATTRS){const v=el.getAttribute(a);if(v){const t=tr(v);if(t!==v)el.setAttribute(a,t)}}
  if(el.tagName==='INPUT'&&(el.type==='submit'||el.type==='button')&&el.value){const t=tr(el.value);if(t!==el.value)el.value=t}
}
function walk(root){
  if(root.nodeType===3){doText(root);return}
  if(root.nodeType!==1)return;
  doEl(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let x;
  while(x=w.nextNode()){if(x.nodeType===3)doText(x);else doEl(x)}
}
function start(){
  document.title=tr(document.title);
  walk(document.body);
  new MutationObserver(list=>{
    for(const r of list){
      if(r.type==='characterData')doText(r.target);
      else if(r.type==='attributes')doEl(r.target);
      else r.addedNodes.forEach(walk);
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  wireButtons();
}
function wireButtons(){
  const go=()=>document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.textContent=lang==='sq'?'English':'Shqip';
    b.setAttribute('lang',lang==='sq'?'en':'sq');
    b.title=lang==='sq'?'Switch to English':'Kalo në shqip';
    b.onclick=e=>{e.preventDefault();try{localStorage.setItem(KEY,lang==='sq'?'en':'sq')}catch(x){}location.reload()};
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
