export const demoUsers = [
 {name:'Alex Morgan',email:'creator@brandguard.ai',password:'creator123',role:'Creator',initials:'AM'},
 {name:'Jordan Lee',email:'reviewer@brandguard.ai',password:'reviewer123',role:'Reviewer',initials:'JL'},
 {name:'Taylor Smith',email:'admin@brandguard.ai',password:'admin123',role:'Admin',initials:'TS'},
 {name:'Morgan Chen',email:'legal@brandguard.ai',password:'legal123',role:'Legal',initials:'MC'}
];
export const documents = [
 {id:'BG-1048',name:'Q4 Product Launch Campaign',type:'Campaign',owner:'Alex Morgan',date:'Nov 04, 2026',status:'In review',risk:'Medium',issues:3},
 {id:'BG-1047',name:'Enterprise Security Overview',type:'Whitepaper',owner:'Alex Morgan',date:'Nov 03, 2026',status:'Approved',risk:'Low',issues:0},
 {id:'BG-1046',name:'Social Media — November',type:'Social',owner:'Sam Rivera',date:'Nov 02, 2026',status:'Changes requested',risk:'High',issues:7},
 {id:'BG-1045',name:'Customer Success Newsletter',type:'Email',owner:'Alex Morgan',date:'Nov 01, 2026',status:'Approved',risk:'Low',issues:1},
 {id:'BG-1044',name:'Partner Enablement Deck',type:'Presentation',owner:'Priya Shah',date:'Oct 30, 2026',status:'Pending legal',risk:'Critical',issues:5}
];
export const activities = [
 {title:'Q4 Product Launch Campaign submitted',detail:'Alex Morgan · 12 minutes ago',icon:'file'},
 {title:'Security Overview approved',detail:'Jordan Lee · 1 hour ago',icon:'check'},
 {title:'Unsupported claim flagged',detail:'Partner Enablement Deck · 3 hours ago',icon:'alert'},
 {title:'Brand guidelines updated',detail:'Taylor Smith · Yesterday',icon:'book'}
];
export const severityData = [{name:'Critical',value:8},{name:'High',value:19},{name:'Medium',value:34},{name:'Low',value:51}];
export const trendData = [{day:'Mon',scans:24,issues:8},{day:'Tue',scans:31,issues:12},{day:'Wed',scans:28,issues:9},{day:'Thu',scans:42,issues:17},{day:'Fri',scans:37,issues:11},{day:'Sat',scans:19,issues:5},{day:'Sun',scans:33,issues:10}];
