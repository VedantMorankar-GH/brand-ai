import { Component, Suspense, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, OrbitControls, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
function Shield(){
 const group=useRef();
 useFrame((state,delta)=>{if(group.current){group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,(state.pointer.x*.22),4,delta);group.current.rotation.x=THREE.MathUtils.damp(group.current.rotation.x,(-state.pointer.y*.13),4,delta);}});
 const shape=new THREE.Shape();shape.moveTo(0,1.45);shape.quadraticCurveTo(.7,1.15,1.15,.95);shape.lineTo(1.05,-.15);shape.quadraticCurveTo(.85,-1.05,0,-1.55);shape.quadraticCurveTo(-.85,-1.05,-1.05,-.15);shape.lineTo(-1.15,.95);shape.quadraticCurveTo(-.7,1.15,0,1.45);
 return <group ref={group}><mesh><extrudeGeometry args={[shape,{depth:.22,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:24}]}/><meshStandardMaterial color="#102b55" metalness={.82} roughness={.2} emissive="#0759d8" emissiveIntensity={.35}/></mesh><lineSegments><edgesGeometry args={[new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:24})]}/><lineBasicMaterial color="#53baff"/></lineSegments><mesh position={[0,-.03,.3]}><torusGeometry args={[.48,.035,12,64]}/><meshBasicMaterial color="#62c9ff"/></mesh><mesh position={[0,-.03,.32]}><boxGeometry args={[.12,.43,.05]}/><meshBasicMaterial color="#d9f5ff"/></mesh><mesh position={[0,-.23,.32]}><boxGeometry args={[.34,.1,.05]}/><meshBasicMaterial color="#d9f5ff"/></mesh></group>
}
function Scene({reduced}){return <><ambientLight intensity={.65}/><pointLight position={[4,4,5]} intensity={3} color="#3d9dff"/><pointLight position={[-4,-2,3]} intensity={2} color="#8a5cff"/><Stars radius={35} depth={25} count={900} factor={2} fade speed={.35}/><Sparkles count={65} scale={5} size={2} speed={.25} color="#69bdff"/><Float speed={reduced?0:1.2} rotationIntensity={reduced?0:.12} floatIntensity={reduced?0:.3}><Shield/></Float><OrbitControls enableZoom={false} enablePan={false} autoRotate={!reduced} autoRotateSpeed={.35} maxPolarAngle={Math.PI/1.8} minPolarAngle={Math.PI/3}/></>}
class SceneBoundary extends Component {
 constructor(props){super(props);this.state={failed:false}}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(){this.props.onFailure?.()}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}
export default function ShieldScene(){const [failed,setFailed]=useState(false);const reduced=useReducedMotion();return <div className="shield-scene">{!failed?<SceneBoundary onFailure={()=>setFailed(true)} fallback={<div className="shield-fallback">✦<span>BRAND<br/>PROTECTED</span></div>}><Canvas camera={{position:[0,0,5.1],fov:42}} dpr={[1,1.5]} gl={{antialias:true,alpha:true}} onCreated={({gl})=>{gl.setClearColor('#000000',0)}}><Suspense fallback={null}><Scene reduced={reduced}/></Suspense></Canvas></SceneBoundary>:<div className="shield-fallback">✦<span>BRAND<br/>PROTECTED</span></div>}</div>}
