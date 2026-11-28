// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {attachManualOrderDrag} from '../src/manual-order-drag';
let body:HTMLElement,rows:HTMLElement[],dispose:()=>void,drop:ReturnType<typeof vi.fn>;
function rect(top:number,height:number){return {top,bottom:top+height,left:0,right:300,width:300,height,x:0,y:top,toJSON(){}};}
function pointer(target:EventTarget,type:string,x:number,y:number,extra:Record<string,unknown>={}){
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.assign(event,{pointerId:1,isPrimary:true,pointerType:'touch',...extra});target.dispatchEvent(event);return event;
}
beforeEach(()=>{
 vi.useFakeTimers();body=document.createElement('div');body.className='pv-tree';document.body.append(body);
 vi.spyOn(body,'getBoundingClientRect').mockImplementation(()=>rect(0,200) as DOMRect);
 rows=['a','b','c','pinned'].map((key,i)=>{const row=document.createElement('div');row.className='pv-group';row.dataset.key=key;const header=document.createElement('div');header.className='pv-property-row';const grip=document.createElement('button');grip.className='pv-grip';header.append(grip);row.append(header);body.append(row);vi.spyOn(row,'getBoundingClientRect').mockImplementation(()=>rect(i*40-body.scrollTop,40) as DOMRect);vi.spyOn(header,'getBoundingClientRect').mockImplementation(()=>rect(i*40-body.scrollTop,40) as DOMRect);return row;});
 drop=vi.fn();dispose=attachManualOrderDrag({rows:rows.slice(0,3),keys:['a','b','c'],scrollEl:body,onDrop:drop});
});
afterEach(()=>{dispose();vi.runOnlyPendingTimers();vi.useRealTimers();vi.restoreAllMocks();document.body.replaceChildren();});
const grip=(index:number)=>rows[index].querySelector<HTMLElement>('button')!;
it('previews touch movement without reparenting rows, then commits once and suppresses the click',()=>{
 const start=[...body.children];pointer(grip(2),'pointerdown',10,90);pointer(document,'pointermove',10,5);
 expect(body.querySelector('.pv-drop-indicator')).not.toBeNull();expect([...body.children].slice(0,4)).toEqual(start);expect(rows[3].classList.contains('pv-drag-other-group')).toBe(true);expect(drop).not.toHaveBeenCalled();
 pointer(document,'pointerup',10,5);expect(drop).toHaveBeenCalledExactlyOnceWith('c','a');expect(body.querySelector('.pv-drop-indicator')).toBeNull();
 const click=vi.fn();body.addEventListener('click',click);grip(0).click();expect(click).not.toHaveBeenCalled();
 pointer(grip(0),'pointerdown',10,5);grip(0).click();expect(click).toHaveBeenCalledTimes(1);
});
it('drops at the end but rejects another pinned group',()=>{
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,115);pointer(document,'pointerup',10,115);expect(drop).toHaveBeenCalledWith('a',null);
 drop.mockClear();pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,150);pointer(document,'pointerup',10,150);expect(drop).not.toHaveBeenCalled();
});
it.each(['pointercancel','lostpointercapture','Escape','dispose'])('cancels %s without saving',mode=>{
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,90);
 if(mode==='Escape')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));else if(mode==='dispose')dispose();else pointer(document,mode,10,90);
 pointer(document,'pointerup',10,90);expect(drop).not.toHaveBeenCalled();expect(body.querySelector('.pv-drop-indicator')).toBeNull();expect(body.classList.contains('pv-dragging')).toBe(false);
});
it('ignores clicks below the threshold, secondary pointers, and presses away from the grip',()=>{
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',11,7);pointer(document,'pointerup',11,7);
 pointer(rows[0],'pointerdown',10,5);pointer(document,'pointermove',10,90);pointer(document,'pointerup',10,90);
 pointer(grip(0),'pointerdown',10,5,{isPrimary:false});pointer(document,'pointermove',10,90);pointer(document,'pointerup',10,90);expect(drop).not.toHaveBeenCalled();
});
it('continues autoscrolling near the edge and stops after cancellation',async()=>{
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,190);await vi.advanceTimersByTimeAsync(50);expect(body.scrollTop).toBeGreaterThan(0);
 pointer(document,'pointercancel',10,190);const at=body.scrollTop;await vi.advanceTimersByTimeAsync(100);expect(body.scrollTop).toBe(at);
});
it('accepts a drop in the empty area below the last property',()=>{
 rows[3].remove();pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,185);pointer(document,'pointerup',10,185);expect(drop).toHaveBeenCalledExactlyOnceWith('a',null);
});
it('rejects drops outside the horizontal pane boundary',()=>{
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',350,90);pointer(document,'pointerup',350,90);expect(drop).not.toHaveBeenCalled();
});
it('drops relative to expanded property headers and respects their pinned boundary',()=>{
 vi.spyOn(body,'getBoundingClientRect').mockReturnValue(rect(0,500) as DOMRect);
 vi.spyOn(rows[1],'getBoundingClientRect').mockReturnValue(rect(40,220) as DOMRect);
 for(const [i,top] of [[2,260],[3,300]]){vi.spyOn(rows[i],'getBoundingClientRect').mockReturnValue(rect(top,40) as DOMRect);vi.spyOn(rows[i].querySelector('.pv-property-row')!,'getBoundingClientRect').mockReturnValue(rect(top,40) as DOMRect);}
 pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,150);pointer(document,'pointerup',10,150);expect(drop).toHaveBeenCalledExactlyOnceWith('a','c');
 drop.mockClear();pointer(grip(0),'pointerdown',10,5);pointer(document,'pointermove',10,300);pointer(document,'pointerup',10,300);expect(drop).not.toHaveBeenCalled();
});
