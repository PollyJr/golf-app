import { describe, expect, it } from "vitest";
import { formatToPar, rankBestRounds, scoreToPar, totalStrokes } from "./score";

describe("score helpers",()=>{
  it("calculates strokes and relative score",()=>{
    const scores=[{hole:1,strokes:2},{hole:2,strokes:3},{hole:3,strokes:4}];
    expect(totalStrokes(scores)).toBe(9);
    expect(scoreToPar(scores,[3,3,3])).toBe(0);
  });
  it("ignores unplayed holes",()=>expect(totalStrokes([{hole:1,strokes:null}])).toBe(0));
  it("formats scores relative to par",()=>{
    expect(formatToPar(-2)).toBe("-2"); expect(formatToPar(0)).toBe("E"); expect(formatToPar(3)).toBe("+3");
  });
  it("shares positions for equal relative scores",()=>{
    const rows=rankBestRounds([
      {id:"a",name:"A",initials:"A",score:25,toPar:-2,course:"Nine",rounds:2,movement:0},
      {id:"b",name:"B",initials:"B",score:70,toPar:-2,course:"Eighteen",rounds:2,movement:0},
      {id:"c",name:"C",initials:"C",score:27,toPar:0,course:"Nine",rounds:2,movement:0}
    ]);
    expect(rows.map(row=>row.rank)).toEqual([1,1,3]);
  });
});
