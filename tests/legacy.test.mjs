import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {JSDOM, VirtualConsole} from 'jsdom'

test('supplied interface boots and preserves full workspace, task creation and editing', async (t) => {
 const errors=[]
 const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e.message))
 const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>.*?<\/script>/gs,'')
 const dom=new JSDOM(html,{url:'https://vn.example',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc})
 t.after(()=>dom.window.close())
 const w=dom.window
 w.vnUserId='test-user'; w.vnQueueSave=()=>{}; w.vnPhotoGallery=()=>''; w.vnPhotoEditor=()=>'<div class="vn-photo-editor"></div>';w.vnDraftPhotos=()=>[{path:'test-user/photo.jpg',name:'Photo'}]
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}})
 w.Sortable=class {static create(){return {destroy(){}}} destroy(){}}
 w.eval(readFileSync('src/legacy/app.js','utf8'))
 assert.ok(w.vnLegacy)
 const payload=w.vnLegacy.initial();payload.data.cards=[];payload.data.notes=[]
 w.vnLegacy.load(payload);w.vnLegacy.start()
 assert.ok(w.document.querySelectorAll('.column').length>0)
 w.showAddCardModal(w.vnLegacy.snapshot().data.columns[0].id)
 assert.ok(w.document.querySelector('#card-description'))
 assert.ok(w.document.querySelector('.vn-photo-editor'))
 w.document.querySelector('#card-title').value='Tâche de test'
 // Test the actual add function exposed by the supplied application.
 w.createCard(w.vnLegacy.snapshot().data.columns[0].id,true)
 const task=w.vnLegacy.snapshot().data.cards.find(c=>c.title==='Tâche de test')
 assert.ok(task); assert.equal(task.photos[0].name,'Photo')
 w.editCard(task.id)
 assert.ok(w.document.querySelector('.vn-photo-editor'))
 assert.equal(w.document.querySelector('#card-title').value,'Tâche de test')
 assert.deepEqual(errors,[])
 dom.window.close()
})
