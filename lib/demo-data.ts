import type { Course, EventItem, LeaderboardEntry, Player } from "./types";

const shortgolf = [37,45,46,31,45,48,60,32,50].map((distance, index) => ({ number:index+1, par:3, distance }));
const heathland = [112,128,96,141,104,133,87,119,125].map((distance, index) => ({ number:index+1, par:index===3?4:3, distance }));

export const courses: Course[] = [
  { id:"shortgolf", name:"Shortgolf Twente", holes:9, accent:"#c6f04d", tee:"Club", totalPar:27, layout:shortgolf,
    description:"Een toegankelijke, uitdagende par-3 baan tussen het Twentse groen." },
  { id:"heidebaan", name:"De Heidebaan", holes:9, accent:"#f3a953", tee:"Geel", totalPar:28, layout:heathland,
    description:"Technisch golf met glooiende greens, heide en karaktervolle bunkers." },
  { id:"landgoed", name:"Landgoed Course", holes:18, accent:"#80b8ff", tee:"Geel", totalPar:72,
    description:"Een volwaardige parkbaan langs bosranden en oude eiken.",
    layout:Array.from({length:18},(_,i)=>({number:i+1,par:[4,4,3,5,4,3,4,5,4,4,3,5,4,4,3,5,4,4][i],distance:[312,344,148,462,326,171,358,478,301,337,152,488,319,365,164,471,329,350][i]})) }
];

export const players: Player[] = [
  { id:"me", name:"Sophie de Vries", initials:"SV", code:"TWT-4821", rounds:18 },
  { id:"p2", name:"Daan Jansen", initials:"DJ", code:"TWT-1934", rounds:24 },
  { id:"p3", name:"Mila Bakker", initials:"MB", code:"TWT-8172", rounds:11 },
  { id:"p4", name:"Sem de Boer", initials:"SB", code:"TWT-3760", rounds:14 }
];

export const leaderboard: LeaderboardEntry[] = [
  {id:"p2",rank:1,name:"Daan Jansen",initials:"DJ",score:24,toPar:-3,course:"Shortgolf Twente",rounds:4,movement:1},
  {id:"me",rank:2,name:"Sophie de Vries",initials:"SV",score:25,toPar:-2,course:"Shortgolf Twente",rounds:3,movement:1},
  {id:"p3",rank:3,name:"Mila Bakker",initials:"MB",score:26,toPar:-1,course:"Shortgolf Twente",rounds:3,movement:-1},
  {id:"p4",rank:4,name:"Sem de Boer",initials:"SB",score:27,toPar:0,course:"Shortgolf Twente",rounds:5,movement:0},
  {id:"p5",rank:5,name:"Noah Smit",initials:"NS",score:28,toPar:1,course:"Shortgolf Twente",rounds:2,movement:2},
  {id:"p6",rank:6,name:"Emma Visser",initials:"EV",score:29,toPar:2,course:"Shortgolf Twente",rounds:2,movement:-1}
];

export const events: EventItem[] = [
  {id:"summer",title:"Twente Summer Cup",date:"2026-07-25",time:"10:00",courseId:"shortgolf",description:"Een zomerse clubwedstrijd voor ieder niveau, afgesloten met een gezamenlijke borrel.",capacity:48,registered:36,featured:true},
  {id:"clinic",title:"Shortgame clinic",date:"2026-08-02",time:"14:00",courseId:"heidebaan",description:"Werk in een kleine groep aan chippen, pitchen en putten met onze clubprofessional.",capacity:16,registered:12},
  {id:"friday",title:"Friday Sunset Nine",date:"2026-08-07",time:"18:30",courseId:"shortgolf",description:"Negen holes in de avondzon. Informeel, gezellig en met een drankje na afloop.",capacity:32,registered:21}
];
