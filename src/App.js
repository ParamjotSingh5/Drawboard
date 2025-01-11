import './App.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {getStroke} from "perfect-freehand";
import rough from 'roughjs/bundled/rough.esm';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Item from '@mui/material/Grid2';
import Button from '@mui/material/Button';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HandymanIcon from '@mui/icons-material/Handyman';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import GestureIcon from '@mui/icons-material/Gesture';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import ButtonGroup from '@mui/material/ButtonGroup';

import MenuIcon from '@mui/icons-material/Menu';

import Typography from '@mui/material/Typography';


const generator =  rough.generator();

const Shapes = {
  LINE: 'line',
  RECTANGLE: 'rectangle'
}  

function createElement(id, x1, y1, x2, y2, type){  
  switch(type){
    case "line":
    case "rectangle":
      const roughElement = type === "line" 
        ? generator.line(x1, y1, x2, y2)
        : generator.rectangle(x1, y1, x2-x1, y2-y1);
      return {id, x1, y1, x2, y2, type, roughElement};
    case "pencil":
      return {id, type, points: [{x: x1, y:y1}]};
    case "text":
      return {id, type, x1, y1, text:""};      
    default:
      throw new Error(`Type not recognized: ${type}`);
  }  
}

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
}

const isWithinElement = (x, y, element) =>{
  const {type, x1, x2, y1, y2} = element;

  switch(type){
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y, 1);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside": null;      
      return topLeft || topRight || bottomRight || bottomLeft || inside;
    case "pencil":
      const betweenAnyPoint = element.points.some((points, index) =>{
        const nextPoint = element.points[index + 1];
        if(!nextPoint) return false;
        return onLine(points.x, points.y, nextPoint.x, nextPoint.y, x, y, 2);
      });      
      return betweenAnyPoint ? "inside": null;
    case "text":
      return x >= x1 && x <= x1 && y >= y1 && y <= y2 ? "inside": null;
    default:
      throw new Error(`Type not recognized: ${type}`);
  }
}

const onLine = (x1, y1, x2, y2, x, y, maxOffset) =>{
  const a = {x: x1, y: y1};
  const b = {x: x2, y: y2};
  const c = {x, y};
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxOffset ? "inside": null;
}

const distance = (a, b) =>{
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

const getElementAtPosition = (x, y, elements) =>{
  return elements.map(element =>(
    {...element, position: isWithinElement(x, y, element)}
    )).find(element => element.position !== null); 
}

const cursorForPosition = position =>{
  switch(position){
    case "tl":
    case "br":
    case "start":
    case "end": 
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
}

const resizedCoordinates = (clientX, clientY, position, coordinates) =>{
  const {x1, y1, x2, y2} = coordinates;
  switch(position){
    case "tl":
    case "start":
      return{x1: clientX, y1: clientY, x2, y2};
    case "tr":
      return{x1, y1: clientY, x2: clientX, y2};
    case "bl":
      return{x1: clientX, y1, x2, y2: clientY};
    case "br":
    case "end":
      return{x1, y1, x2:  clientX, y2: clientY};
    default:
      return null;
  }
}

const adjustElementCoordinates = element => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

const useHistory = initialState =>{
  const[index, setIndex] = useState(0);
  const[history, setHistory] = useState([initialState]);  

  const setState = (action, overwrite = false) =>{
    const newState = typeof action === "function" ? action(history[index]) : action;
    
    if(overwrite){
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    }else{
      const updatedState = [...history].slice(0, index + 1);
      setHistory(prevState => [...updatedState, newState]);
      setIndex(prevState => prevState + 1);
    }
  };

  const undo = () => { index > 0 && setIndex(prevState => prevState - 1) }
  const redo = () => { index < history.length - 1 && setIndex(prevState => prevState + 1)}

  return [history[index], setState, undo, redo];
}

const getSvgPathFromStroke = (stroke) =>{
  if(!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i+1) % arr.length];
      acc.push(x0, y0, (x0 + x1)/2, (y0 + y1)/2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

const drawElement = (roughCanvas, context, element) =>{
  switch(element.type){
    case "line":
    case "rectangle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      const myStroke = getSvgPathFromStroke(getStroke(element.points,  {
        size: 4,
        thinning: 0.1,
        smoothing: 0.2,
        streamline: 0.9,
        easing: (t) => t,
        simulatePressure: false,
        last: true,
        start: {
          cap: true,
          taper: 3,
          easing: (t) => t,
        },
        end: {
          cap: true,
          taper: 3,
          easing: (t) => t,
        },
      }));
      context.fill(new Path2D(myStroke));
      break;
    case "text":
      context.font ="24px sans-serif";
      context.fillText(element.text, element.x1, element.y1);
      break;
    default:
      throw new Error(`Type not recognized: ${element.type}`);
  }
}

const adjustmentRequired = (type) => ['line', 'rectangle'].includes(type);


function App() {
  const[elements, setElements, undo, redo] = useHistory([]);
  const[action, setAction] = useState("none");
  const[tool, setTool] = useState("text");
  const [open, setOpen] = useState(false);
  const[selectedElement, setSelectedElement] = useState(null)
  const textAreaRef = useRef();

  useLayoutEffect(() =>{
    const canvas = document.getElementById("canvas");
    
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);
    
    elements.forEach((element) => drawElement(roughCanvas, context, element));
  }, [elements]);

  useEffect(() =>{
    const undoRedoFunction = event =>{
      if((event.metaKey || event.ctrlKey) && event.key === "z"){
          undo();        
      }
      else if((event.metaKey || event.ctrlKey) && event.key === "y"){
        redo();
      }
    };

    document.addEventListener("keydown", undoRedoFunction);

    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if(action === "writing") textArea.focus();
  }, [action]);

  const updateElement = (index, x1, y1, x2, y2, tool) =>{
    const elementsCopy = [...elements];

    switch(tool){
      case "line":
      case "rectangle":
        elementsCopy[index] = createElement(index, x1, y1, x2, y2, tool);
        break;
      case "pencil":
        elementsCopy[index].points = [...elementsCopy[index].points, {x: x2, y: y2}];
        break;
      default:
        throw new Error(`Type not recognized: ${tool}`);
    }

    setElements(elementsCopy, true);
  }

  const toggleDrawer = (newOpen) => () => {
    setOpen(newOpen);
  };


  const handleMouseDown = (event) =>{
    const {clientX, clientY} = event;
    if(tool === "selection"){      
      const element = getElementAtPosition(clientX, clientY, elements);
      if(element){
        if(element.type === "pencil"){
          const xOffsets = element.points.map(point => clientX - point.x);
          const yOffsets = element.points.map(point => clientY - point.y);
          setSelectedElement({...element, xOffsets, yOffsets});
        }
        else{
          const offsetX = clientX - element.x1;
          const offsetY = clientY - element.y1;
          setSelectedElement({...element, offsetX, offsetY});
          setElements(prevState => prevState);
        }

        if(element.position === "inside"){
          setAction("moving");
        }          
        else{
         setAction("resizing");
        }
      }
    }else{             
      const id = elements.length;
      const element = createElement(id, clientX, clientY, clientX, clientY, tool);
      setElements( prevState => [...prevState, element]);
      setSelectedElement(element);
      setAction(tool === "text" ? "writing" : "drawing");
    }
  };

  const handleMouseUp = (event) =>{

    if(selectedElement){
      const index = selectedElement.id;
      const {id, type} = elements[index];
      if((action === 'drawing' || action === "resizing") && adjustmentRequired(type)){
        const {x1, y1, x2, y2} = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }   

    if(action === "writing") return;

    setAction("none");
    setSelectedElement(null);
  };
  
  const handleMouseMove = (event) =>{
    const {clientX, clientY} = event;

    if(tool === "selection"){
      const element = getElementAtPosition(clientX, clientY, elements);
      event.target.style.cursor = element ? cursorForPosition(element.position) : "default";
    }    
    
    if(action === "drawing"){            
      const index = elements.length - 1;    
      const {x1, y1} = elements[index];
      updateElement(index, x1, y1, clientX, clientY, tool);      
    }
    else if(action === "moving"){
      if(selectedElement.type === "pencil"){
        const newPoints = selectedElement.points.map((_, index) =>({
          x: clientX - selectedElement.xOffsets[index],
          y: clientY - selectedElement.yOffsets[index]
        }));
        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints
        };
        setElements(elementsCopy, true);
      }
      else{
        const {id, x1, y1, x2, y2, type, offsetX, offsetY} = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const nexX1 = clientX - offsetX;
        const nexY1 = clientY - offsetY;
        updateElement(id, nexX1, nexY1, nexX1 + width, nexY1 + height, type)
      }      
    }
    else if(action === "resizing"){
      const {id, type, position, ...coordinates } = selectedElement;
      const {x1, y1, x2, y2} = resizedCoordinates(clientX, clientY, position, coordinates);
      updateElement(id, x1, y1, x2, y2, type);
    }
  };

  const handleToolSwitch = (event) =>{
    
  }

  const DrawerList = (
    <Box sx={{ width: 250 }} role="presentation" onClick={toggleDrawer(false)}>
      <Typography variant="h5" component="div" sx={{ p: 2 }}>
        haaaaaaaaaaaaa
      </Typography>
    </Box>
  );

  const floatingButton = (
    <Box sx={{position: "fixed", top: '75%', left: 0, zIndex: 0, p: 1, 
      boxShadow: 24, borderRadius: 3, m:1}} >
      <ButtonGroup orientation="vertical" aria-label="Vertical button group">
        <Button key="undo" id="undo" sx={{p:1}} value={"undo"} onClick={undo}>
          <UndoIcon />
        </Button>
        <Button key="redo" id="redo" sx={{p:1}} value={"redo"} onClick={redo}>
          <RedoIcon />
        </Button>
      </ButtonGroup>      
    </Box>
  )

  const toolSelector =(
    <Box
    sx={{ position:'fixed', top: '25%', left: 0, zIndex: 0, p: 1, 
      boxShadow: 24, borderRadius: 3, m:1
    }}
    >
    <ButtonGroup orientation="vertical" aria-label="Vertical button group">
      <Button key="selection" id='selection' variant={tool === 'selection' ? 'contained' : 'text' } sx={{p:1, borderRadius: 3}} value={"selection"} onClick={() => {setTool("selection"); }} > <OpenWithIcon/></Button>
      <Button key="line" id='line' sx={{p:1, borderRadius: 3}} variant={tool === 'line' ? 'contained' : 'text' } value={"line"} onClick={() => {setTool("line"); }}  ><ShowChartIcon/></Button>
      <Button key="rectangle" id='rectangle' sx={{p:1, borderRadius: 3}} variant={tool === 'rectangle' ? 'contained' : 'text' } value={"rectangle"} onClick={() => {setTool("rectangle"); }}  > <CropSquareIcon/></Button>
      <Button key="pencil" id='pencil' sx={{p:1, borderRadius: 3}} variant={tool === 'pencil' ? 'contained' : 'text' } value={"pencil"} onClick={() => {setTool("pencil"); handleToolSwitch(this)}}  > <GestureIcon/></Button>
      
    </ButtonGroup>
    
    </Box>
  );

  return (
    <Box>
      <Button sx={{position: 'fixed', top: 20, left:0, p:2, backgroundColor:'white'}} variant="text" startIcon={<MenuIcon />} onClick={toggleDrawer(true)}>
        <Typography variant="button" gutterBottom sx={{ display: 'block' }}>Dashboard
        </Typography>
      </Button>
      <Drawer open={open} onClose={toggleDrawer(false)}>
        {DrawerList}
      </Drawer>
      {toolSelector}
      {floatingButton}
      <Item>
        <canvas id='canvas' 
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove} height={window.innerHeight} 
        width={window.innerWidth} style={{backgroundColor:"#656B811A"}}
        > Canvas</canvas>
      </Item>
    </Box>
  );
}

export default App;
