/* Visitor tour: the real planner, filled with sample data and view only. app.js asks for this instead of api.php when window.SPL_TOUR is set. */
(function(){
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  window.SPL_TOUR=function(){
    const T=new Date();T.setHours(0,0,0,0);
    const mon=addDays(T,-((T.getDay()+6)%7));
    const day=n=>iso(addDays(T,n));
    let id=0;const nid=()=>'t'+(++id);

    // the usual week: weekday -> hour -> entry
    const lec=(t)=>({text:t,type:'uni'}),stu=(t)=>({text:t,type:'study'});
    const weekly=[
      {8:lec('Algorithms lecture'),9:lec('Algorithms lecture'),11:stu('Databases, ch. 4'),14:stu('OOP lab report'),19:{text:'Gym',type:'health'}},
      {9:lec('Databases'),10:lec('Databases'),13:{text:'Café shift',type:'work'},14:{text:'Café shift',type:'work'},15:{text:'Café shift',type:'work'}},
      {8:lec('OOP lecture'),9:lec('OOP lecture'),12:{text:'Lunch with Ana',type:'personal'},16:stu('Revise algorithms')},
      {10:lec('Databases lab'),11:lec('Databases lab'),14:stu('Group project'),19:{text:'Gym',type:'health'}},
      {9:lec('Algorithms lab'),10:lec('Algorithms lab'),13:{text:'Café shift',type:'work'},14:{text:'Café shift',type:'work'},15:{text:'Café shift',type:'work'},16:{text:'Café shift',type:'work'}},
      {11:stu('Read chapter 4'),15:{text:'Meet friends',type:'personal'}},
      {10:{text:'Rest day',type:'personal'},16:stu('Plan next week')}
    ];
    const hours={};
    hours[day(0)]={20:{text:'Call home',type:'personal'}};

    const cats=[['Food',[4.5,6.2,8.9,12]],['Coffee',[2.2,2.5,3]],['Transport',[1.5,1.5,20]],['Groceries',[14.3,22.6,31.4]],['School',[6,12.8]],['Fun',[8,15]],['Phone',[10]],['Other',[3.5]]];
    const exps=[];
    for(let i=0;i<75;i++){
      const c=cats[(i*3)%cats.length],amt=c[1][i%c[1].length];
      exps.push({id:nid(),date:day(-Math.floor(i*0.9)),desc:{Food:'Lunch',Coffee:'Coffee',Transport:'Bus',Groceries:'Groceries',School:'Printing',Fun:'Cinema',Phone:'Top-up',Other:'Misc'}[c[0]],cat:c[0],amount:amt});
    }
    exps.sort((a,b)=>a.date<b.date?-1:1);

    const tasks=[
      {title:'Finish OOP lab report',due:day(0),priority:'high',tag:'OOP',done:false},
      {title:'Read chapter 4, Databases',due:day(1),priority:'med',tag:'Databases',done:false},
      {title:'Email group about project',due:day(2),priority:'med',tag:'',done:false},
      {title:'Buy notebook',due:day(3),priority:'low',tag:'',done:true},
      {title:'Hand in scholarship form',due:day(-2),priority:'high',tag:'',done:false},
      {title:'Book dentist',due:day(9),priority:'low',tag:'',done:false}
    ].map(t=>({id:nid(),...t}));

    const study=[
      {subject:'Databases',topic:'Normal forms',h:2,rev:false,p:2},{subject:'Algorithms',topic:'Sorting',h:1.5,rev:true,p:1},
      {subject:'OOP',topic:'Lab report',h:2,rev:false,p:2},{subject:'Databases',topic:'SQL joins',h:1,rev:false,p:1},
      {subject:'Algorithms',topic:'Graphs',h:2,rev:false,p:1},{subject:'',topic:'',h:0,rev:false,p:1},{subject:'',topic:'',h:0,rev:false,p:1}
    ];
    const ex=(n)=>day(n);
    const upcoming=[{id:nid(),t:'Databases exam',date:ex(9)},{id:nid(),t:'OOP lab due',date:ex(0)},{id:nid(),t:'Algorithms exam',date:ex(23)}];
    const chap=(title,done,topics)=>({id:nid(),title,done,src:'',topics:topics.map(([t,d])=>({id:nid(),t,done:d}))});
    const subjects=[
      {id:nid(),name:'Databases',c:'school',exam:ex(9),chapters:[chap('ER diagrams',true,[['Entities',true],['Relationships',true]]),chap('SQL',false,[['SELECT',true],['Joins',false],['Subqueries',false]]),chap('Normal forms',false,[['1NF to 3NF',false]])]},
      {id:nid(),name:'Algorithms',c:'transport',exam:ex(23),chapters:[chap('Sorting',true,[['Merge sort',true],['Quick sort',true]]),chap('Graphs',false,[['BFS',true],['Dijkstra',false]])]},
      {id:nid(),name:'OOP',c:'food',exam:'',chapters:[chap('Classes',true,[['Inheritance',true]]),chap('Patterns',false,[['Factory',false],['Observer',false]])]}
    ];
    return {user:{name:'there'},settings:{income:900,goal:1200},months:{},note:'Exam in 9 days, you got this!',exps,tasks,hours,weekly,blockDone:{},study,upcoming,subjects,google:{configured:false,connected:false,email:'',needsSync:false}};
  };
})();
