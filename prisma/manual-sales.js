// Transcribed from the handwritten daily sheets (photos), July 1-20, 2026.
// Names map through PosMap. "Drink 24 oz" / "Drink 20 oz" are cup-size buckets
// (the notebook tracks cups, not flavors) mapped to a representative product
// for costing. Revenue figures are the actual dollars written on each sheet.
// [date, posName, qty, revenue$]
const manualSales = [
  // Wednesday 07-01-26 (sheet total $301)
  ["2026-07-01","Elote Chico",22,110],["2026-07-01","Elote Grande",2,14],
  ["2026-07-01","Drink 24 oz",4,20],["2026-07-01","Drink 20 oz",13,91],
  ["2026-07-01","Elote Entero",1,5],["2026-07-01","Crepas",7,56],["2026-07-01","Sopa",1,5],
  // Thursday 07-02-26 ($390)
  ["2026-07-02","Elote Chico",26,130],["2026-07-02","Elote Grande",9,63],
  ["2026-07-02","Drink 24 oz",4,20],["2026-07-02","Drink 20 oz",6,42],
  ["2026-07-02","Fresa Con Crema 16 oz",4,28],["2026-07-02","Elote Entero",1,5],
  ["2026-07-02","Crepas",5,40],["2026-07-02","Conchitas",1,7],["2026-07-02","Sopa",4,20],
  ["2026-07-02","Tostitos",2,14],["2026-07-02","Takis",3,21],
  // Friday 07-03-26 ($388)
  ["2026-07-03","Elote Chico",19,95],["2026-07-03","Elote Grande",13,91],
  ["2026-07-03","Drink 24 oz",6,30],["2026-07-03","Drink 20 oz",11,77],
  ["2026-07-03","Fresa Con Crema 16 oz",1,7],["2026-07-03","Elote Entero",1,5],
  ["2026-07-03","Crepas",5,40],["2026-07-03","Cheetos",1,7],["2026-07-03","Sopa",1,5],
  ["2026-07-03","Red Bull Preparado",2,10],["2026-07-03","Tostitos",3,21],
  // Saturday 07-04-26 ($446)
  ["2026-07-04","Elote Chico",24,120],["2026-07-04","Elote Grande",8,56],
  ["2026-07-04","Drink 24 oz",7,35],["2026-07-04","Drink 20 oz",17,119],
  ["2026-07-04","Fresa Con Crema 16 oz",4,28],["2026-07-04","Vaso Nieve 1 Scoop",2,5],
  ["2026-07-04","Crepas",8,64],["2026-07-04","Cheetos",2,14],["2026-07-04","Sopa",1,5],
  // Sunday 07-05-26 ($591 itemized; sheet wrote 596)
  ["2026-07-05","Elote Chico",45,225],["2026-07-05","Elote Grande",10,70],
  ["2026-07-05","Drink 24 oz",10,50],["2026-07-05","Drink 20 oz",9,63],
  ["2026-07-05","Fresa Con Crema 16 oz",6,42],["2026-07-05","Elote Entero",1,5],
  ["2026-07-05","Crepas",12,96],["2026-07-05","Doritos",1,7],["2026-07-05","Sopa",1,5],
  ["2026-07-05","Tostitos",1,7],["2026-07-05","Takis",3,21],
  // Monday 07-06-26 ($270)
  ["2026-07-06","Elote Chico",22,110],["2026-07-06","Elote Grande",5,35],
  ["2026-07-06","Drink 24 oz",7,35],["2026-07-06","Drink 20 oz",7,49],
  ["2026-07-06","Fresa Con Crema 16 oz",2,14],["2026-07-06","Elote Entero",1,5],
  ["2026-07-06","Doritos",1,7],["2026-07-06","Red Bull Preparado",3,15],
  // Tuesday 07-07-26 ($520)
  ["2026-07-07","Elote Chico",24,120],["2026-07-07","Elote Grande",10,70],
  ["2026-07-07","Drink 24 oz",11,55],["2026-07-07","Drink 20 oz",14,98],
  ["2026-07-07","Fresa Con Crema 16 oz",6,42],["2026-07-07","Elote Entero",1,5],
  ["2026-07-07","Crepas",10,80],["2026-07-07","Conchitas",3,21],["2026-07-07","Doritos",1,7],
  ["2026-07-07","Sopa",2,10],["2026-07-07","Red Bull Preparado",1,5],["2026-07-07","Takis",1,7],
  // Wednesday 07-08-26 ($261)
  ["2026-07-08","Elote Chico",19,95],["2026-07-08","Elote Grande",3,21],
  ["2026-07-08","Drink 24 oz",7,35],["2026-07-08","Drink 20 oz",2,14],
  ["2026-07-08","Fresa Con Crema 16 oz",3,21],["2026-07-08","Elote Entero",3,15],
  ["2026-07-08","Crepas",6,48],["2026-07-08","Doritos",1,7],["2026-07-08","Sopa",1,5],
  // Thursday 07-09-26 ($249)
  ["2026-07-09","Elote Chico",17,85],["2026-07-09","Elote Grande",5,35],
  ["2026-07-09","Drink 24 oz",3,15],["2026-07-09","Drink 20 oz",5,35],
  ["2026-07-09","Fresa Con Crema 16 oz",6,42],["2026-07-09","Crepas",4,32],
  ["2026-07-09","Red Bull Preparado",1,5],
  // Friday 07-10-26 ($345 incl. extra queso)
  ["2026-07-10","Elote Chico",24,120],["2026-07-10","Elote Grande",5,35],
  ["2026-07-10","Drink 24 oz",9,45],["2026-07-10","Drink 20 oz",4,28],
  ["2026-07-10","Fresa Con Crema 16 oz",1,7],["2026-07-10","Elote Entero",1,5],
  ["2026-07-10","Crepas",9,72],["2026-07-10","Sopa",2,10],["2026-07-10","Tostitos",1,7],
  ["2026-07-10","Takis",2,14],["2026-07-10","Queso Extra",1,2],
  // Saturday 07-11-26 ($579)
  ["2026-07-11","Elote Chico",31,155],["2026-07-11","Elote Grande",6,42],
  ["2026-07-11","Drink 24 oz",12,60],["2026-07-11","Drink 20 oz",21,147],
  ["2026-07-11","Fresa Con Crema 16 oz",5,35],["2026-07-11","Crepas",13,104],
  ["2026-07-11","Doritos",1,7],["2026-07-11","Hot Drink",1,5],
  ["2026-07-11","Red Bull Preparado",2,10],["2026-07-11","Takis",2,14],
  // Sunday 07-12-26 ($801)
  ["2026-07-12","Elote Chico",43,215],["2026-07-12","Elote Grande",13,91],
  ["2026-07-12","Drink 24 oz",10,50],["2026-07-12","Drink 20 oz",22,154],
  ["2026-07-12","Fresa Con Crema 16 oz",9,63],["2026-07-12","Crepas",22,176],
  ["2026-07-12","Sopa",2,10],["2026-07-12","Tostitos",4,28],["2026-07-12","Takis",2,14],
  // Monday 07-13-26 ($387)
  ["2026-07-13","Elote Chico",23,115],["2026-07-13","Elote Grande",7,49],
  ["2026-07-13","Drink 24 oz",7,35],["2026-07-13","Drink 20 oz",8,56],
  ["2026-07-13","Fresa Con Crema 16 oz",2,14],["2026-07-13","Elote Entero",1,5],
  ["2026-07-13","Crepas",12,96],["2026-07-13","Conchitas",1,7],["2026-07-13","Sopa",2,10],
  // Tuesday 07-14-26 ($477)
  ["2026-07-14","Elote Chico",38,190],["2026-07-14","Elote Grande",7,49],
  ["2026-07-14","Drink 24 oz",4,20],["2026-07-14","Drink 20 oz",10,70],
  ["2026-07-14","Fresa Con Crema 16 oz",8,56],["2026-07-14","Elote Entero",1,5],
  ["2026-07-14","Crepas",6,42],["2026-07-14","Conchitas",1,7],["2026-07-14","Sopa",2,10],
  ["2026-07-14","Tostitos",1,7],["2026-07-14","Takis",3,21],
  // Wednesday 07-15-26 ($353.50)
  ["2026-07-15","Elote Chico",13,65],["2026-07-15","Elote Grande",15,105],
  ["2026-07-15","Drink 24 oz",2,10],["2026-07-15","Drink 20 oz",6,42],
  ["2026-07-15","Fresa Con Crema 16 oz",1,7],["2026-07-15","Vaso Nieve 1 Scoop",1,2.5],
  ["2026-07-15","Elote Entero",4,20],["2026-07-15","Crepas",6,48],
  ["2026-07-15","Cheetos",1,7],["2026-07-15","Conchitas",1,7],["2026-07-15","Hot Drink",1,5],
  ["2026-07-15","Tostitos",3,21],["2026-07-15","Takis",2,14],
  // Thursday 07-16-26 ($363)
  ["2026-07-16","Elote Chico",16,80],["2026-07-16","Elote Grande",9,63],
  ["2026-07-16","Drink 24 oz",5,25],["2026-07-16","Drink 20 oz",5,35],
  ["2026-07-16","Fresa Con Crema 16 oz",5,35],["2026-07-16","Elote Entero",2,10],
  ["2026-07-16","Crepas",10,80],["2026-07-16","Cheetos",2,14],["2026-07-16","Doritos",3,21],
  // Friday 07-17-26 ($322 itemized)
  ["2026-07-17","Elote Chico",19,95],["2026-07-17","Elote Grande",3,21],
  ["2026-07-17","Drink 24 oz",1,5],["2026-07-17","Drink 20 oz",13,91],
  ["2026-07-17","Fresa Con Crema 16 oz",6,42],["2026-07-17","Crepas",6,48],
  ["2026-07-17","Sopa",4,20],
  // Saturday 07-18-26 ($464.50)
  ["2026-07-18","Elote Chico",33,165],["2026-07-18","Elote Grande",8,56],
  ["2026-07-18","Drink 24 oz",4,20],["2026-07-18","Drink 20 oz",13,91],
  ["2026-07-18","Fresa Con Crema 16 oz",1,7],["2026-07-18","Vaso Nieve 1 Scoop",1,2.5],
  ["2026-07-18","Elote Entero",1,5],["2026-07-18","Crepas",10,80],
  ["2026-07-18","Conchitas",1,7],["2026-07-18","Doritos",1,7],["2026-07-18","Sopa",1,5],
  ["2026-07-18","Hot Drink",1,5],["2026-07-18","Takis",2,14],
  // Sunday 07-19-26 ($479)
  ["2026-07-19","Elote Chico",18,90],["2026-07-19","Elote Grande",17,119],
  ["2026-07-19","Drink 24 oz",5,25],["2026-07-19","Drink 20 oz",7,49],
  ["2026-07-19","Fresa Con Crema 16 oz",6,42],["2026-07-19","Crepas",8,64],
  ["2026-07-19","Cheetos",1,7],["2026-07-19","Conchitas",2,14],["2026-07-19","Doritos",1,7],
  ["2026-07-19","Sopa",4,20],["2026-07-19","Tostitos",3,21],["2026-07-19","Takis",3,21],
  // Monday 07-20-26 ($377)
  ["2026-07-20","Elote Chico",17,85],["2026-07-20","Elote Grande",8,56],
  ["2026-07-20","Drink 24 oz",4,20],["2026-07-20","Drink 20 oz",10,70],
  ["2026-07-20","Fresa Con Crema 16 oz",2,14],["2026-07-20","Crepas",15,120],
  ["2026-07-20","Cheetos",1,7],["2026-07-20","Sopa",1,5]
];
module.exports = { manualSales };
