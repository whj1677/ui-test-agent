// Process fixture for owned-supervisor tests. It never opens a server or data root.
const index=Number(process.env.FAKE_CHILD_INDEX);
// Simulates the real index.mjs doing top-level await before installing IPC.
setTimeout(()=>{
process.on('message',message=>{
  if(message?.type==='supervisor-hello'){
    process.send({type:'managed-ready',service_instance_id:`fake-${index}`,
      data_root_sha256:index===1||process.env.FAKE_KEEP_IDENTITY==='1'?'same-data':'changed-data',configuration_sha256:'same-config'});
    if(index<=Number(process.env.FAKE_RESTART_COUNT||1))setTimeout(()=>process.send({type:'restart-request',request_id:`fake-restart-${index}`,service_instance_id:`fake-${index}`}),index===2?75:25);
    else setTimeout(()=>process.exit(0),150);
  }
  if(message?.type==='restart-ack'&&message.accepted){
    process.send({type:'restart-drained',closed:true},()=>process.exit(0));
  }
  if(message?.type==='shutdown')process.exit(0);
});
process.send({type:'supervisor-awaiting'});
},50);
