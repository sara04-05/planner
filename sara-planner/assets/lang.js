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
// sharing: header, tabs, notebook
'Delete my account':'Fshi llogarinë time','Change my password':'Ndrysho fjalëkalimin','Change your password':'Ndrysho fjalëkalimin','Change password':'Ndrysho fjalëkalimin','Current password':'Fjalëkalimi aktual','New password':'Fjalëkalimi i ri','New password again':'Fjalëkalimi i ri përsëri','Your password was changed.':'Fjalëkalimi u ndryshua.','Delete your account':'Fshi llogarinë tënde','Delete my account for good':'Fshi llogarinë përgjithmonë','Account':'Llogaria','Explore':'Eksploro','Clear all':'Pastro të gjitha','Search by name':'Kërko sipas emrit','Nothing new. When someone likes one of your posts, you will see it here.':'Asgjë e re. Kur dikush i pëlqen një postim tëndin, do ta shohësh këtu.','Alert when someone likes my post':'Njoftomë kur dikujt i pëlqen postimi im','Type your password to confirm':'Shkruaj fjalëkalimin për të konfirmuar','No, keep my account':'Jo, mbaje llogarinë time','Log in to see who else is on Splanner.':'Kyçu për të parë kush tjetër është në Splanner.','People':'Njerëzit','Notifications':'Njoftimet','Blog':'Blogu','Interests':'Interesat','Profile':'Profili','Alerts':'Njoftimet','My planner':'Planeri im','Your notebook':'Fletorja jote',
'+ New post':'+ Postim i ri','New post':'Postim i ri','Edit post':'Ndrysho postimin','Publish post':'Publiko postimin','Save changes':'Ruaj ndryshimet','Title':'Titulli','Write something':'Shkruaj diçka','Edit':'Ndrysho','Delete':'Fshi','Public':'Publik','Only me':'Vetëm unë','Make public':'Bëje publik','Make private':'Bëje privat',
'Show this post on my public notebook':'Shfaqe këtë postim në fletoren time publike','Attach a picture':'Bashkëngjit një foto','Change picture':'Ndrysho foton','Remove':'Hiq','Uploading…':'Po ngarkohet…',
'No posts yet. Write about your day, a book you finished, a trip — whatever you like. Each post can be private or public.':'Ende pa postime. Shkruaj për ditën, një libër që mbarove, një udhëtim, çfarë të duash. Çdo postim mund të jetë privat ose publik.',
'List':'Listë','Pictures':'Foto','+ My own list':'+ Lista ime','New list':'Listë e re','Create list':'Krijo listën','Name':'Emri','Icon':'Ikona','Show it as':'Trego si','A list':'Një listë','A grid of pictures':'Një rrjet fotosh','Nothing here yet.':'Ende asgjë këtu.','A note (optional)':'Një shënim (opsionale)','Add something you love':'Shto diçka që e do',
'Favourite movies':'Filmat e preferuar','Favourite singers':'Këngëtarët e preferuar','My clothes and style':'Rrobat dhe stili im','Books I love':'Librat që i dua','Favourite food':'Ushqimi i preferuar','Places I want to visit':'Vende që dua t\'i vizitoj',
'Your page':'Faqja jote','Page name':'Emri i faqes','Bio':'Rreth meje','Save':'Ruaj','Open my page ↗':'Hap faqen ime ↗','Copy link':'Kopjo lidhjen','Link copied.':'Lidhja u kopjua.',
'Who can see your notebook':'Kush e sheh fletoren tënde','Public profile':'Profil publik','Visible without logging in':'E dukshme pa u kyçur','What to show':'Çfarë të shfaqet','Blog posts':'Postimet e blogut','Interest lists':'Listat e interesave','Weekly timetable':'Orari javor','Study subjects':'Lëndët e studimit',
'Design your notebook':'Dizajno fletoren tënde','Cover':'Kopertina','Use my own cover':'Përdor kopertinën time','Remove my cover':'Hiq kopertinën time','Paper':'Letra','Lined':'Me vija','Grid':'Katrore','Dots':'Me pika','Plain':'E thjeshtë','Paper colour':'Ngjyra e letrës','Accent colour':'Ngjyra kryesore','Writing':'Shkrimi','Modern':'Modern','Handwritten':'Me dorë','Classic':'Klasik','Typewriter':'Makinë shkrimi','Stickers':'Ngjitëse','Make a sticker from my picture':'Bëj ngjitëse nga fotoja ime','Save design':'Ruaj dizajnin','Undo changes':'Anulo ndryshimet','Selected:':'Zgjedhur:',
'Design saved. This is now your notebook.':'Dizajni u ruajt. Kjo është tani fletorja jote.','Live preview · this is how your notebook will look':'Pamje e drejtpërdrejtë · kështu do të duket fletorja jote','Clear all':'Pastro të gjitha','Tell me when…':'Më njofto kur…','Someone follows me':'Dikush më ndjek','Someone likes my post':'Dikujt i pëlqen postimi im','Follow':'Ndiq','Following':'Po e ndjek','View':'Shiko',
'No alerts yet. When someone follows you or likes a post, you will see it here.':'Ende pa njoftime. Kur dikush të ndjek ose t\'i pëlqejë një postim, do ta shohësh këtu.',
'This notebook is private':'Kjo fletore është private','Log in to open this notebook':'Kyçu për ta hapur këtë fletore','Browse public notebooks':'Shfleto fletoret publike','Search':'Kërko','Nothing is shared here yet.':'Ende nuk ndahet asgjë këtu.','Weekly timetable':'Orari javor','Studying':'Studimi','Create free account':'Krijo llogari falas','Log in':'Kyçu',
'Messages':'Mesazhet','Send':'Dërgo','Write a message…':'Shkruaj një mesazh…','Notebook':'Fletorja','Say hello 👋':'Thuaj përshëndetje 👋','No messages yet. Say hello 👋':'Ende pa mesazhe. Thuaj përshëndetje 👋','Pick someone on the left to start chatting.':'Zgjidh dikë në të majtë për të filluar bisedën.',
'You can only send messages while you follow each other.':'Mund të dërgosh mesazhe vetëm kur ndiqeni të dyja palët.','Message':'Mesazh','Alerts and messages':'Njoftime dhe mesazhe','Let people I follow back message me':'Lejo ata që i ndjek mbrapsht të më shkruajnë',
'Choose which alerts you get and whether people can message you.':'Zgjidh cilat njoftime i merr dhe nëse njerëzit mund të të shkruajnë.',
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
 [/^(.+) is now verified\.$/,(m,a)=>`${a} tani është i verifikuar.`],
 [/^(.+) is no longer verified\.$/,(m,a)=>`${a} nuk është më i verifikuar.`],
 [/^Saved (.+)\.$/,(m,a)=>`U ruajt ${a}.`],
 [/^(\d+) accounts? in this database\.$/,(m,a)=>`${a} llogari në këtë bazë të dhënash.`],
 [/^(.+) sent you a friend request\.$/,(m,a)=>`${a} të dërgoi një kërkesë miqësie.`],
 [/^(.+) accepted your friend request\.$/,(m,a)=>`${a} e pranoi kërkesën tënde për miqësi.`],
 [/^(.+) sent you a message: “([\s\S]*)”$/,(m,a,b)=>`${a} të dërgoi një mesazh: “${b}”`],
 [/^(.+) liked your post “([\s\S]*)”\.$/,(m,a,b)=>`${a} pëlqeu postimin tënd “${b}”.`],
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
/* ---------- look inside (visitor tour), welcome page, guest Explore, new covers ---------- */
Object.assign(T,{'📖 Open the notebook':'📖 Hap fletoren','Pages':'Faqet','Any colour':'Çdo ngjyrë','Pick any colour':'Zgjidh çfarëdo ngjyre','Accent white':'Theks i bardhë','Your notebook opened, with your choices.':'Fletorja jote e hapur, me zgjedhjet e tua.','Contents':'Përmbajtja','Welcome':'Mirë se vjen','A few words about this notebook will show up here.':'Disa fjalë për këtë fletore do të shfaqen këtu.','Inside the notebook':'Brenda fletores','The real notebook with your choices. Use its tabs on the right to look at its other pages.':'Fletorja e vërtetë me zgjedhjet e tua. Përdor skedat në të djathtë për të parë faqet e tjera.','Notebooks and Explore card':'Fletoret dhe karta te Eksploro','Pick a notebook to change its look, name, pages and who sees it. Your first notebook is also your card on Explore, so its cover is what people see there.':'Zgjidh një fletore për të ndryshuar pamjen, emrin, faqet dhe kush e sheh. Fletorja jote e parë është edhe karta jote te Eksploro, ndaj kopertina e saj është ajo që shohin njerëzit atje.','Quick look · your Explore card':'Pamje e shpejtë · karta jote te Eksploro','This is your first notebook, so this cover is also your card on Explore. Click to change this notebook\'s look. It saves straight away; open “Look, colours and stickers” below for your own colours, pictures and stickers.':'Kjo është fletorja jote e parë, ndaj kjo kopertinë është edhe karta jote te Eksploro. Kliko për të ndryshuar pamjen e kësaj fletoreje. Ruhet menjëherë; hap “Pamja, ngjyrat dhe afishet” më poshtë për ngjyrat, fotot dhe afishet e tua.','Quick look':'Pamje e shpejtë',"Click to change this notebook's look. It saves straight away; open “Look, colours and stickers” below for your own colours, pictures and stickers.":'Kliko për të ndryshuar pamjen e kësaj fletoreje. Ruhet menjëherë; hap “Pamja, ngjyrat dhe afishet” më poshtë për ngjyrat, fotot dhe afishet e tua.','Hearts':'Zemra','Rainbows':'Ylberë','Mountains':'Male','Pinstripe':'Vija të holla','Monstera':'Monstera','Preview':'Pamja paraprake',
'Verified account':'Llogari e verifikuar',
'This message was deleted':'Ky mesazh u fshi',
'edited':'u redaktua',
'Message options':'Opsionet e mesazhit',
'Edit message':'Redakto mesazhin',
'Delete for me':'Fshije vetëm për mua',
'Delete for everyone':'Fshije për të gjithë',
'Delete this message for you? The other person will still see it.':'Ta fshij këtë mesazh për ty? Personi tjetër do ta shohë prapë.',
'Delete this message for everyone?':'Ta fshij këtë mesazh për të gjithë?',
'Contact name':'Emri i kontaktit','View profile':'Shiko profilin',
'Delete chat':'Fshi bisedën',
'A name only you will see for this contact (leave empty to use their own name):':'Një emër që e sheh vetëm ti për këtë kontakt (lëre bosh për të përdorur emrin e tyre):',
'Delete this whole conversation for you? The other person keeps their copy.':'Ta fshij gjithë bisedën për ty? Personi tjetër e mban kopjen e tij.',
'Pick a conversation, or start one with someone\'s email.':'Zgjidh një bisedë ose nise një me email-in e dikujt.',
'That message was not found.':'Ky mesazh nuk u gjet.',
'You can only delete your own messages for everyone.':'Mund t\'i fshish për të gjithë vetëm mesazhet e tua.',
'You can only edit your own messages.':'Mund të redaktosh vetëm mesazhet e tua.',
'That message was deleted.':'Ky mesazh u fshi.',
'+ Page':'+ Faqe',
'New page':'Faqe e re',
'Edit page':'Redakto faqen',
'Page name':'Emri i faqes',
'Icon':'Ikona',
'Write on the page':'Shkruaj në faqe',
'Save page':'Ruaj faqen',
'Add page':'Shto faqen',
'Delete page':'Fshi faqen',
'Anything you like…':'Çfarëdo që të duash…',
'e.g. Recipes, Travel plans, Gym':'p.sh. Receta, Plane udhëtimi, Palestra',
'Please write something on the page.':'Shkruaj diçka në faqe.',
'That is plenty of pages! Delete one first.':'Ke mjaft faqe! Fshi një më parë.',
'That page was not found.':'Kjo faqe nuk u gjet.',
'Pages you added yourself':'Faqet që shtove vetë',
'None yet.':'Ende asnjë.',
'+ Add a page':'+ Shto një faqe',
'Look, colours and stickers':'Pamja, ngjyrat dhe afishet',
'Make your own cover colours, use your own picture, and make stickers from your pictures.':'Bëj ngjyrat e tua të kopertinës, përdor foton tënde dhe bëj afishe nga fotot e tua.',
'Add a page':'Shto një faqe',
'Notebooks':'Fletoret',
'Delete account':'Fshi llogarinë',
'Your picture, name, page name and bio.':'Fotoja, emri, emri i faqes dhe bio jote.',
'Page name (your link)':'Emri i faqes (lidhja jote)',
'Save account':'Ruaj llogarinë',
'Privacy and alerts':'Privatësia dhe njoftimet',
'Each switch saves straight away. Open “What others see” to check the result.':'Çdo çelës ruhet menjëherë. Hap “Çfarë shohin të tjerët” për të parë rezultatin.',
'People with an account can open it and send you a friend request.':'Njerëzit me llogari mund ta hapin dhe të të dërgojnë kërkesë miqësie.',
'Also show it to visitors who have no account. Needs a public profile.':'Shfaqe edhe për vizitorët pa llogari. Duhet profil publik.',
'Show me in Explore':'Më shfaq te Eksploro',
'Off by default: Explore only lists people who switch this on. Friends and your link work either way.':'Çaktivizuar si parazgjedhje: Eksploro liston vetëm njerëzit që e aktivizojnë këtë. Miqtë dhe lidhja jote funksionojnë në të dyja rastet.',
'Who can see my day (today’s hour-by-hour plan, nothing else of your planner)':'Kush mund ta shohë ditën time (plani i sotëm orë pas ore, asgjë tjetër nga planeri yt)',
'Shows in the bell at the top of the page.':'Shfaqet te zilja në krye të faqes.',
'My card on Explore':'Karta ime te Eksploro',
'The cover people see next to your name. Pick one or use your own picture.':'Kopertina që shohin njerëzit pranë emrit tënd. Zgjidh një ose përdor foton tënde.',
'Your own picture':'Fotoja jote',
'Shown in handwriting on the pink spiral covers. Empty shows your name.':'Shfaqen me shkrim dore te kopertinat rozë me spirale. Bosh shfaq emrin tënd.',
'Pick a notebook to change its name, pages and who sees it.':'Zgjidh një fletore për të ndryshuar emrin, faqet dhe kush e sheh.',
'Logs you out and removes your account and everything in it for good.':'Të nxjerr jashtë dhe e heq llogarinë tënde me gjithçka brenda përgjithmonë.',
'You have no notebooks yet. Make one in the Notebooks tab.':'Ende nuk ke fletore. Bëj një te skeda Fletoret.',
'Picture saved.':'Fotoja u ruajt.',
'Pick a picture first.':'Zgjidh një foto më parë.',
'Settings':'Cilësimet',
'Private':'Privat',
'Role':'Roli',
'Sub admin':'Nën-admin',
'Admin':'Admin',
'Owner':'Pronari',
'User':'Përdorues',
'Verify':'Verifiko',
'Remove tick':'Hiq shenjën',
'Verified account (blue tick)':'Llogari e verifikuar (shenjë blu)',
'This is the owner account. Its role can\'t be changed.':'Kjo është llogaria e pronarit. Roli i saj nuk ndryshohet.',
'Sub admin (can only look at this page)':'Nën-admin (mund ta shohë vetëm këtë faqe)',
'Admin (can change everything here)':'Admin (mund të ndryshojë gjithçka këtu)',
'This page is only for the site\'s admins.':'Kjo faqe është vetëm për adminët e faqes.',
'A sub admin can only look at the users.':'Një nën-admin mund t\'i shohë vetëm përdoruesit.',
'Only the owner can take admin rights away from another admin.':'Vetëm pronari mund t\'ia heqë të drejtat e adminit një admini tjetër.',
'Roles: Admin changes everything on this page · Sub admin can only look at it · User is everybody else.':'Rolet: Admin ndryshon gjithçka në këtë faqe · Nën-admin mund ta shohë vetëm · Përdorues janë të gjithë të tjerët.',
'You are the owner: you can edit accounts, give the verified tick and set roles.':'Ti je pronari: mund të redaktosh llogari, të japësh shenjën e verifikimit dhe të caktosh role.',
'You are an admin: you can edit accounts, give the verified tick and set roles.':'Ti je admin: mund të redaktosh llogari, të japësh shenjën e verifikimit dhe të caktosh role.',
'You are a sub admin: you can look at the users but not change anything.':'Ti je nën-admin: mund t\'i shohësh përdoruesit por nuk mund të ndryshosh asgjë.',
'New: every Study subject now has its own notebook in Notes, with a place for each chapter.':'E re: çdo lëndë e Studimit ka tani fletoren e vet te Shënimet, me një vend për çdo kapitull.',
'Nothing new. Friend requests, messages and likes show up here.':'Asgjë e re. Kërkesat e miqësisë, mesazhet dhe pëlqimet shfaqen këtu.',
'Look inside':'Shiko brenda','Look inside the planner':'Shiko brenda planerit','Look inside · Splanner':'Shiko brenda · Splanner',
'Open the real planner with sample data and click through every page: Day, Week, Month, Year, Study, Tasks and Expenses. It is view only, so nothing is saved until you have an account.':'Hap planerin e vërtetë me të dhëna shembull dhe kalo nëpër çdo faqe: Dita, Java, Muaji, Viti, Studimi, Detyrat dhe Shpenzimet. Është vetëm për shikim, ndaj asgjë nuk ruhet derisa të kesh llogari.',
'Open the full planner preview':'Hap pamjen e plotë të planerit',
"with every page. Click the tabs. Tick a task. It is view only: nothing is saved, and you can't change anything until you log in.":"me çdo faqe. Kliko skedat. Shëno një detyrë. Është vetëm për shikim: asgjë nuk ruhet dhe nuk mund të ndryshosh asgjë derisa të kyçesh.",
'You are looking around.':'Po shikon përreth.',
'This is the real planner with sample data, view only. Nothing can be added or saved.':'Ky është planeri i vërtetë me të dhëna shembull, vetëm për shikim. Asgjë nuk mund të shtohet ose ruhet.',
'Create a free account':'Krijo një llogari falas','log in':'kyçu','to use it.':'për ta përdorur.',
'This is a preview, so nothing is saved. Log in or create a free account to use it.':'Kjo është vetëm një pamje paraprake, ndaj asgjë nuk ruhet. Kyçu ose krijo një llogari falas për ta përdorur.',
'You are looking as a visitor. You can read the notebooks that people chose to show to everyone. To add friends, like, message or make your own,':'Po shikon si vizitor. Mund të lexosh fletoret që njerëzit zgjodhën t\'i shfaqin për të gjithë. Për të shtuar miq, pëlqyer, dërguar mesazhe ose bërë të tuat,',
'create a free account':'krijo një llogari falas',
'Nobody has chosen to be listed in Explore yet.':'Askush nuk ka zgjedhur ende të listohet te Eksploro.','Nobody has made a notebook visible to visitors yet.':'Askush nuk ka bërë ende një fletore të dukshme për vizitorët.',
'Nobody matches that search.':'Askush nuk përputhet me këtë kërkim.',
'Search by name':'Kërko sipas emrit',
'Cherry blossom':'Lulëzim qershie','Dark academia':'Akademi e errët','Gingham':'Katrorë gingham','Bows':'Fjongo','Starry night':'Natë me yje','Clouds':'Re','Lavender':'Livando','Daisies':'Margarita','Checkerboard':'Tabelë shahu','Strawberries':'Luleshtrydhe','Terrazzo':'Terrazo','Waves':'Valë','Polka dots':'Pika','Sunset':'Perëndim dielli'
});
// music (Spotify)
Object.assign(T,{
'songs':'këngë','Press play to start':'Shtyp luaj për të nisur',"Couldn't start playing. Try again in a moment.":'Nuk u nis dot. Provo përsëri pas pak.','Playing in Spotify':'Po luan në Spotify','Suggested playlists':'Lista të sugjeruara','Chill beats to relax and study to':'Ritme të qeta për t\'u çlodhur dhe për të studiuar','Calm, steady music to help you concentrate':'Muzikë e qetë dhe e qëndrueshme për t\'u përqendruar','Soft piano to unwind with':'Piano e butë për t\'u çlodhur','Driving beats for long study sessions':'Ritme energjike për seanca të gjata studimi',
'Music':'Muzika','Play a Spotify link':'Luaj një lidhje Spotify','Play':'Luaj','Pop out player ↗':'Hap luajtësin veçmas ↗','Playing in the small window ↗':'Po luan në dritaren e vogël ↗',
'In Spotify, open a playlist, album, song or podcast and use Share → Copy link. Without a Spotify login you hear 30-second previews; logged in to Spotify in this browser, whole songs play.':'Në Spotify, hap një listë, album, këngë ose podkast dhe përdor Share → Copy link. Pa u kyçur në Spotify dëgjon pjesë 30-sekondëshe; kur je kyçur në Spotify në këtë shfletues, luhen këngët e plota.',
'Your Spotify':'Spotify yt','Connected as':'I lidhur si','Disconnect':'Shkëput','Search songs and playlists':'Kërko këngë dhe lista','Search Spotify':'Kërko në Spotify','Your playlists':'Listat e tua','Loading your playlists…':'Po hapen listat e tua…',
'Playing on this page needs Spotify Premium. Your playlists open in the player above instead.':'Për të luajtur në këtë faqe duhet Spotify Premium. Listat e tua hapen në luajtësin më lart.',
'Connect your Spotify':'Lidh Spotify-n tënd','See your own playlists here and play them while you plan.':'Shiko listat e tua këtu dhe luaji ndërsa planifikon.','Connect Spotify':'Lidh Spotify',
"Playing inside Splanner needs Spotify Premium. While Splanner's Spotify app is in test mode, only people the site owner added in the Spotify dashboard can connect.":'Për të luajtur brenda Splanner duhet Spotify Premium. Sa kohë aplikacioni Spotify i Splanner është në modalitet testimi, mund të lidhen vetëm njerëzit që pronari i faqes i ka shtuar në panelin e Spotify.',
'Let people connect their Spotify':'Lejo njerëzit të lidhin Spotify-n e tyre','Only you see this. Put SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in config.php (steps in README.md), and add this Redirect URI in the Spotify dashboard:':'Këtë e sheh vetëm ti. Vendos SPOTIFY_CLIENT_ID dhe SPOTIFY_CLIENT_SECRET te config.php (hapat te README.md), dhe shto këtë Redirect URI në panelin e Spotify:',
'Nothing playing yet':'Ende nuk po luhet asgjë','Previous song':'Kënga e mëparshme','Next song':'Kënga tjetër','Play or pause':'Luaj ose ndalo','Volume':'Volumi','Spotify player':'Luajtësi Spotify','Spotify link':'Lidhja Spotify',
'Spotify is connected. Pick one of your playlists below.':'Spotify u lidh. Zgjidh një nga listat e tua më poshtë.',
'Spotify is disconnected. You can also remove Splanner under "Manage apps" in your Spotify account.':'Spotify u shkëput. Mund ta heqësh Splanner edhe te "Manage apps" në llogarinë tënde Spotify.',
'Spotify was not connected.':'Spotify nuk u lidh.',
"This Spotify account can't connect yet. Splanner's Spotify app is in test mode, so the site owner has to add your Spotify email in the Spotify dashboard first.":'Kjo llogari Spotify ende nuk mund të lidhet. Aplikacioni Spotify i Splanner është në modalitet testimi, prandaj pronari i faqes duhet ta shtojë më parë email-in tënd të Spotify në panelin e Spotify.',
'Connecting Spotify is not set up on this site yet.':'Lidhja me Spotify ende nuk është konfiguruar në këtë faqe.',
"That doesn't look like a Spotify link. Copy it in Spotify with Share → Copy link.":'Kjo nuk duket si lidhje Spotify. Kopjoje në Spotify me Share → Copy link.',
'Saved. This plays next time you open Music.':'U ruajt. Kjo luhet herën tjetër që hap Muzikën.',"Couldn't connect Spotify. Please try again.":'Spotify nuk u lidh. Provo përsëri.',
'No playlists in your Spotify yet.':'Ende pa lista në Spotify-n tënd.',"Couldn't load your playlists. Try again in a minute.":'Listat nuk u hapën. Provo përsëri pas një minute.',
'Searching…':'Po kërkohet…','My playlists':'Listat e mia','Play any Spotify link':'Luaj çdo lidhje Spotify','Paste the link to one of your Spotify playlists':'Ngjit lidhjen e një liste tënde në Spotify','Link to your playlist':'Lidhja e listës tënde','My playlist':'Lista ime','Album':'Album','Song':'Këngë','Artist':'Artist','Podcast episode':'Episod podkasti','Podcast':'Podkast',
"In Spotify, open your playlist, tap ⋯ → Share → Copy link to playlist, and paste it here. If a playlist doesn't play, make it public in Spotify (⋯ → Make public).":'Në Spotify, hap listën tënde, shtyp ⋯ → Share → Copy link to playlist dhe ngjite këtu. Nëse një listë nuk luhet, bëje publike në Spotify (⋯ → Make public).',
'Added to My playlists.':'U shtua te Listat e mia.','Removed from My playlists.':'U hoq nga Listat e mia.','My playlists is full. Remove one to add another.':'Listat e mia janë plot. Hiq një për të shtuar tjetër.',"Couldn't add it. Try again in a minute.":'Nuk u shtua. Provo përsëri pas një minute.',
'Nothing found.':'Nuk u gjet asgjë.',"Couldn't search Spotify. Try again in a minute.":'Kërkimi në Spotify nuk funksionoi. Provo përsëri pas një minute.',"Couldn't reach Spotify":'Spotify nuk u arrit'
});
// study notebook (notes.php)
// welcome page: notes, friends, messages, music
Object.assign(T,{'Friends & music':'Miq dhe muzikë','Explore':'Eksploro','Eight pages, one planner':'Tetë faqe, një planer',
'Plan your day hour by hour, keep your study notes, count down to exams and see exactly where your money goes. Then make a notebook of your own, add friends and play your music. Try it right here before you sign up.':'Planifiko ditën orë pas ore, mbaj shënimet e studimit, numëro ditët deri te provimet dhe shih saktë ku shkojnë paratë. Pastaj krijo një fletore të tuajën, shto miq dhe dëgjo muzikën. Provoje këtu para se të regjistrohesh.',
'Your study notebook: pages of notes, whiteboards to draw on, and PDFs, slides and pictures, filed under each subject.':'Fletorja jote e studimit: faqe shënimesh, tabela për të vizatuar, dhe PDF, prezantime e foto, të renditura sipas lëndës.',
'More than a planner':'Më shumë se një planer','Your planner stays private. Everything below is optional, and you decide who sees what.':'Planeri yt mbetet privat. Gjithçka më poshtë është opsionale dhe ti vendos kush çfarë sheh.',
'Your own notebook':'Fletorja jote','Pick a cover, add a picture and a bio, and fill pages with a blog and lists of what you love. Keep it private or share it with a link.':'Zgjidh një kopertinë, shto një foto dhe një bio, dhe mbushi faqet me një blog dhe lista me atë që do. Mbaje private ose ndaje me një lidhje.',
'Friends':'Miqtë','Add friends by name or email. They can open your notebook cover and see your plan for today, and nothing else from your planner.':'Shto miq me emër ose email. Ata mund ta hapin kopertinën e fletores dhe të shohin planin tënd të sotëm, por asgjë tjetër nga planeri.',
'Switch it on and others can find your notebook. Leave it off and nobody will see you in the list.':'Ndize dhe të tjerët mund ta gjejnë fletoren tënde. Lëre të fikur dhe askush nuk të shef në listë.',
'Messages':'Mesazhet','Write to friends, edit or delete what you sent, and give people your own nicknames. Messages are stored scrambled.':'Shkruaju miqve, ndrysho ose fshi atë që dërgove, dhe jepu njerëzve pseudonimet e tua. Mesazhet ruhen të koduara.',
'Music':'Muzika','Paste a Spotify playlist, album or song and it plays on the page. Save your favourites and keep a small player open while you plan.':'Ngjit një listë, album ose këngë nga Spotify dhe luhet në faqe. Ruaj të preferuarat dhe mbaj një luajtës të vogël hapur ndërsa planifikon.',
'Alerts':'Njoftimet',"A bell tells you about friend requests, new messages and likes, so you don't have to keep checking.":'Një zile të lajmëron për kërkesat për miqësi, mesazhet e reja dhe pëlqimet, pa pasur nevojë të kontrollosh vazhdimisht.',
'English and Shqip':'Anglisht dhe Shqip','Switch the whole site between English and Albanian with one button, and pick light or dark to suit your eyes.':'Ndërro tërë faqen mes anglishtes dhe shqipes me një buton, dhe zgjidh dritën ose errësirën sipas syve.',
'Google Calendar':'Google Calendar',"Send your hour-by-hour plan to your Google Calendar if you'd like it on your phone's calendar too, or bring in a planner you already have.":'Dërgoje planin orë pas ore te Google Calendar nëse e do edhe në kalendarin e telefonit, ose sill një planer që e ke tashmë.',
'Scramble your messages':'I kodojmë mesazhet','Messages are stored encrypted, and only the two people in a chat can read them.':'Mesazhet ruhen të enkriptuara dhe vetëm dy personat e bisedës mund t\'i lexojnë.',
'Every save is tied to your account. Friends and visitors only see what you choose to share.':'Çdo ruajtje lidhet me llogarinë tënde. Miqtë dhe vizitorët shohin vetëm atë që zgjedh të ndash.',
'Your email is only used to log in and to check it is really yours.':'Email-i përdoret vetëm për hyrje dhe për të provuar që është i yti.',
'Show your plans or messages to strangers':'Ua tregojmë planet ose mesazhet të huajve','Nobody is listed in Explore unless they switch it on.':'Askush nuk del te Eksploro nëse nuk e ndez vetë.',
"No. Your planner, tasks, money and notes are only visible when you're logged in to your own account. Friends you accept can see your plan for today, and only that.":'Jo. Planeri, detyrat, paratë dhe shënimet shihen vetëm kur je i kyçur në llogarinë tënde. Miqtë që pranon mund të shohin planin tënd të sotëm, dhe vetëm atë.',
'What is Explore?':'Çfarë është Eksploro?','A list of people who chose to show their notebook. You are only in it if you switch "Show me in Explore" on, and you can switch it off again at any time.':'Një listë me njerëz që zgjodhën të shfaqin fletoren. Ti ndodhesh aty vetëm nëse ndez "Më shfaq te Eksploro", dhe mund ta fikësh kur të duash.',
'Who can read my messages?':'Kush mund t\'i lexojë mesazhet e mia?','Only you and the person you wrote to. Messages are stored encrypted, and you can edit or delete yours.':'Vetëm ti dhe personi të cilit i shkrove. Mesazhet ruhen të enkriptuara dhe mund t\'i ndryshosh ose fshish të tuat.',
'Do I need Spotify to use the Music page?':'A më duhet Spotify për faqen e muzikës?',"No. Paste any Spotify link and it plays in Spotify's own player. Connecting your Spotify account is optional, where the site has it turned on.":'Jo. Ngjit çdo lidhje Spotify dhe luhet në luajtësin e vetë Spotify-t. Lidhja e llogarisë Spotify është opsionale, aty ku faqja e ka të ndezur.',
'Can I use it in Albanian?':'A mund ta përdor në shqip?','Yes. Press the Shqip button at the top of any page to switch the whole site, and English to switch back.':'Po. Shtyp butonin Shqip në krye të çdo faqeje për të ndërruar tërë faqen, dhe English për t\'u kthyer.',
'Your study notebook':'Fletorja jote e studimit','Databases, chapter 4':'Bazat e të dhënave, kapitulli 4','Normal forms: 1NF, 2NF, 3NF…':'Format normale: 1NF, 2NF, 3NF…','ER diagram sketch':'Skica e diagramit ER','Whiteboard':'Tabela','Algorithms slides.pdf':'Prezantimi i algoritmeve.pdf','Study file':'Skedar studimi','OOP lab checklist':'Lista e laboratorit OOP','Inheritance vs. composition':'Trashëgimia kundrejt kompozimit','pages':'faqe'});
Object.assign(T,{'Notes':'Shënimet','Your study notebook':'Fletorja jote e studimit','🎨 New whiteboard':'🎨 Tabelë e re','📝 New page':'📝 Faqe e re','Search your notes':'Kërko te shënimet','All':'Të gjitha',
'No pages match.':'Asnjë faqe nuk përputhet.','No pages yet. Start one with “New page” or “New whiteboard”.':'Ende pa faqe. Fillo një me “Faqe e re” ose “Tabelë e re”.','Files':'Skedarët',
'Everything here is private. Only you can see it.':'Gjithçka këtu është private. Vetëm ti e sheh.','Notes page':'Faqe shënimesh','Write lecture notes and keep the files for that lesson with them.':'Shkruaj shënimet e ligjëratës dhe mbaj skedarët e asaj ore bashkë me to.',
'Whiteboard':'Tabela','Draw, write by hand, label diagrams and sketch over pictures.':'Vizato, shkruaj me dorë, shëno diagramet dhe skico mbi fotot.','Upload study files':'Ngarko skedarë studimi',
'PDFs, slides, Word, pictures and music. A page is made for them.':'PDF, prezantime, Word, foto dhe muzikë. Bëhet një faqe për to.','Up to':'Deri në','a file':'për skedar','in total':'gjithsej','Study files':'Skedarë studimi',
'All pages':'Të gjitha faqet','Whiteboard title':'Titulli i tabelës','Page title':'Titulli i faqes','Paper':'Letra','Lined paper':'Letër me vija','Squared paper':'Letër me katrorë','Dotted paper':'Letër me pika','Plain paper':'Letër e bardhë','Blackboard':'Dërrasë e zezë',
'All saved':'U ruajt','Saving…':'Po ruhet…','Not saved':'Nuk u ruajt','Delete page':'Fshi faqen','Page deleted.':'Faqja u fshi.','Sure? Click again':'Je i sigurt? Kliko përsëri',
'Start writing… Your notes save by themselves.':'Fillo të shkruash… Shënimet ruhen vetë.','Untitled page':'Faqe pa titull','Untitled whiteboard':'Tabelë pa titull','Your whiteboard':'Tabela jote',
'This whiteboard is empty. Open it to start drawing.':'Kjo tabelë është bosh. Hape për të filluar vizatimin.','Open the whiteboard':'Hap tabelën','Study files & pictures':'Skedarë studimi dhe foto','Add files':'Shto skedarë',
'Drop files here, or use “Add files”.':'Lësho skedarët këtu, ose përdor “Shto skedarë”.','PDF, Word, PowerPoint, Excel, pictures, music and short videos, up to':'PDF, Word, PowerPoint, Excel, foto, muzikë dhe video të shkurtra, deri në','each.':'secili.',
'Draw on it':'Vizato mbi të','Download':'Shkarko','Delete':'Fshi','Close':'Mbyll',"this kind of file can't be added.":'ky lloj skedari nuk mund të shtohet.','too big. The most is':'shumë i madh. Maksimumi është',
'Pen':'Stilolaps','Highlighter':'Theksues','Eraser':'Gomë','Line':'Vijë','Arrow':'Shigjetë','Box':'Kuti','Circle':'Rreth','Text':'Tekst','Picture':'Foto','Colour':'Ngjyra','Any colour':'Çdo ngjyrë','Size':'Madhësia',
'Undo':'Zhbëj','Redo':'Ribëj','Clear the board':'Pastro tabelën','Save as picture':'Ruaje si foto','Done':'Kryer','Not saved. Click Done again to leave anyway.':'Nuk u ruajt. Kliko përsëri Kryer për të dalë gjithsesi.',
'Type, then click outside':'Shkruaj, pastaj kliko jashtë','Drag to resize':'Tërhiq për të ndryshuar madhësinë','Place picture':'Vendos foton','Cancel':'Anulo','That picture could not be opened.':'Kjo foto nuk u hap dot.',
'That file is too big.':'Ky skedar është shumë i madh.','No connection. Try again.':'Pa lidhje. Provo përsëri.','The file did not upload. Try again.':'Skedari nuk u ngarkua. Provo përsëri.',
"That kind of file can't be added. You can add PDF, Word, PowerPoint, Excel, text, pictures, music and short videos.":'Ky lloj skedari nuk mund të shtohet. Mund të shtosh PDF, Word, PowerPoint, Excel, tekst, foto, muzikë dhe video të shkurtra.',
'That page was not found. It may have been deleted.':'Kjo faqe nuk u gjet. Mund të jetë fshirë.','The drawing did not save. Try again.':'Vizatimi nuk u ruajt. Provo përsëri.','Study material: files, notes and whiteboards':'Materiali i studimit: skedarë, shënime dhe tabela','Add the slides, PDFs, pictures or your own notes for this chapter.':'Shto prezantimet, PDF-të, fotot ose shënimet e tua për këtë kapitull.','📎 Upload files':'📎 Ngarko skedarë','📝 Write notes':'📝 Shkruaj shënime','🎨 Whiteboard':'🎨 Tabela','Material for chapter':'Material për kapitullin','That picture seems to be broken. Try saving it again as a JPG or PNG.':'Kjo foto duket e dëmtuar. Provo ta ruash përsëri si JPG ose PNG.','The file could not be saved on the server. Try again.':'Skedari nuk u ruajt dot në server. Provo përsëri.'});
// the same buttons without their emoji (icons are drawn by assets/icons.svg now)
Object.assign(T,{'New whiteboard':'Tabelë e re','Upload files':'Ngarko skedarë','Write notes':'Shkruaj shënime','Whiteboard':'Tabela','Open as a visitor':'Hape si vizitor','Find time':'Gjej kohë','Find time together':'Gjej kohë së bashku','Decorate':'Dekoro','Shown':'E shfaqur','Pill':'Pilulë','Ticket':'Biletë','Use my own cover picture':'Përdor foton time të kopertinës','files':'skedarë','Say hello':'Thuaj përshëndetje','No messages yet. Say hello':'Ende pa mesazhe. Thuaj përshëndetje'});
// colour looks
Object.assign(T,{'Colour theme':'Tema e ngjyrave','The classic':'Klasikja','Calm and neutral':'Të qeta e neutrale','Softer':'Më të buta','Notebook cover':'Kopertina e fletores','First, choose how Splanner looks. Your notebook starts in the same colours. You can change every detail later.':'Së pari zgjidh si duket Splanner. Fletorja jote nis me të njëjtat ngjyra. Çdo detaj mund ta ndryshosh më vonë.'});
Object.assign(T,{'Night and morning · 00:00–12:00':'Nata dhe mëngjesi · 00:00–12:00','Afternoon and evening · 12:00–24:00':'Pasdite dhe mbrëmja · 12:00–24:00','Colour angle':'Këndi i ngjyrave','Pattern on the cover':'Motivi në kopertinë','None':'Asnjë','Stripes':'Vija','Dots':'Pika','Grid':'Rrjetë','Waves':'Valë','Checks':'Katrorë','Name box place':'Vendi i kutisë së emrit','Top':'Lart','Middle':'Në mes','Bottom':'Poshtë','My letter or picture':'Shkronja ose fotoja ime','Box text colour':'Ngjyra e tekstit të kutisë'});
// Notes: a notebook for every subject, with a place for each chapter
Object.assign(T,{'Your notebooks':'Fletoret e tua','There is a notebook for every subject in your Study tab. Open one to take notes and keep files chapter by chapter. Everything here is private. Only you can see it.':'Për çdo lëndë në skedën Studim ka një fletore. Hap një për të shkruar shënime dhe për të ruajtur skedarë, kapitull pas kapitulli. Gjithçka këtu është private. Vetëm ti e sheh.',
'New notebook':'Fletore e re','New notebook, e.g. Linear Algebra':'Fletore e re, p.sh. Algjebër lineare','Notebook name':'Emri i fletores','Create notebook':'Krijo fletoren','Notebook added. It is in your Study tab too.':'Fletorja u shtua. Është edhe te skeda Studim.',
'All notebooks':'Të gjitha fletoret','Recent pages':'Faqet e fundit','Search results':'Rezultatet e kërkimit','Where you are':'Ku je',
'+ Add a chapter':'+ Shto një kapitull','Add a chapter to':'Shto një kapitull te','Chapter':'Kapitulli','Chapters':'Kapitujt','chapter':'kapitull','chapters':'kapituj','page':'faqe','file':'skedar','No chapter':'Pa kapitull',
'General notes':'Shënime të përgjithshme','General files':'Skedarë të përgjithshëm','Other pages':'Faqe të tjera','Pages that are not in a notebook yet.':'Faqe që nuk janë ende në ndonjë fletore.',
'No pages yet. Open a notebook to start one.':'Ende pa faqe. Hap një fletore për të nisur një.','No chapters yet. Add the first one below.':'Ende pa kapituj. Shto të parin më poshtë.',
'No chapters yet. Add the chapters of this subject (the same ones are in your Study tab) and every chapter gets its own pages and files.':'Ende pa kapituj. Shto kapitujt e kësaj lënde (të njëjtët janë edhe te skeda Studim) dhe çdo kapitull merr faqet dhe skedarët e vet.',
'No pages here yet. Write the notes for this chapter on a page, or draw on a whiteboard.':'Ende pa faqe këtu. Shkruaj shënimet e këtij kapitulli në një faqe, ose vizato në një tabelë.',
'Open the page this file is on':'Hap faqen ku ndodhet ky skedar','Give the notebook a name.':'Jepi fletores një emër.','Give the chapter a name.':'Jepi kapitullit një emër.','That notebook was not found. It may have been deleted.':'Kjo fletore nuk u gjet. Mund të jetë fshirë.',
'Open notebook':'Hap fletoren','Open in notebook':'Hap te fletorja','Your notes and files for this subject, chapter by chapter':'Shënimet dhe skedarët e tu për këtë lëndë, kapitull pas kapitulli'});
P.push(
 [/^That file is too big\. The most you can upload is (\d+) MB a file\.$/,(m,a)=>`Ky skedar është shumë i madh. Mund të ngarkosh deri në ${a} MB për skedar.`],
 [/^Your notebook is full \((\d+) MB of files\)\. Delete some old files first\.$/,(m,a)=>`Fletorja jote është plot (${a} MB skedarë). Fshi disa skedarë të vjetër më parë.`],
 [/^Uploading (.+)…$/,(m,a)=>`Po ngarkohet ${a}…`],
 [/^(.+\.[A-Za-z0-9]{2,5}) added\.$/,(m,a)=>`${a} u shtua.`],
 [/^Study material for (.+)$/,(m,a)=>`Materiali i studimit për ${a}`],
 [/^You have (\d+) (files|pages) already\. Delete some old ones first\.$/,(m,a,b)=>`Ke tashmë ${a} ${b==='files'?'skedarë':'faqe'}. Fshi disa të vjetra më parë.`]);
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
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg><span class="lbl">'+(lang==='sq'?'English':'Shqip')+'</span>';b.setAttribute('aria-label',lang==='sq'?'English':'Shqip');
    b.setAttribute('lang',lang==='sq'?'en':'sq');
    b.title=lang==='sq'?'Switch to English':'Kalo në shqip';
    b.onclick=e=>{e.preventDefault();try{localStorage.setItem(KEY,lang==='sq'?'en':'sq')}catch(x){}location.reload()};
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
