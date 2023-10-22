import logo from './logo.svg';
import './App.css';
import { useLayoutEffect, useState } from 'react';
import rough from 'roughjs/bundled/rough.esm';

const generator = rough.generator();

function createElement(x1, y1, x2, y2, elementType){
  const roughElement =
  elementType === "line" 
    ? generator.line(x1, y1, x2, y2)
    : generator.rectangle(x1, y1, x2-x1, y2-y1);

  return {x1, y1, x2, y2, roughElement};
}

function App() {

  const[elements, setElements] = useState([]);
  const[drawing, setDrawing] = useState(false);
  const[elementType, setElementType] = useState('line');

  useLayoutEffect(() =>{
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);
    
    elements.forEach(({roughElement}) => roughCanvas.draw(roughElement));
  }, [elements]);

  const handleMouseDown = (event) =>{
    setDrawing(true);
    const {clientX, clientY} = event;
    const element = createElement(clientX, clientY, clientX, clientY, elementType);
    setElements( prevState => [...prevState, element]);
  };

  const handleMouseUp = (event) =>{
    setDrawing(false);
  };
  
  const handleMouseMove = (event) =>{
    if(!drawing) return;

    const {clientX, clientY} = event;
    const index = elements.length - 1;    
    const {x1, y1} = elements[index];
    const updatedElement = createElement(x1, y1, clientX, clientY, elementType);    
    
    const elementsCopy = [...elements];
    elementsCopy[index] = updatedElement;
    setElements(elementsCopy);
  };

  return (
  <div>
    <div style={{position: "fixed"}}>
      <input
        type='radio'
        id='line'
        checked = {elementType === 'line'}
        onChange={() => setElementType("line")}
        value={"line"}
      />
      <label htmlFor='line'>Line</label>
      <input
        type='radio'
        id='rectangle'
        checked = {elementType === 'rectangle'}
        onChange={() => setElementType("rectangle")}
        value={"rectangle"}
      />
      <label htmlFor='rectangle'>Rectangle</label>
    </div>    
    <div>
    <canvas id='canvas' height={window.innerHeight} 
    width={window.innerWidth} 
    onMouseDown={handleMouseDown}
    onMouseUp={handleMouseUp}
    onMouseMove={handleMouseMove}
    > Canvas</canvas>
    </div>
   </div>
  );
}

export default App;
