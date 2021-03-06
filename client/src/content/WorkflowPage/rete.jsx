import React, { useState, useEffect, useRef } from "react";
import 'regenerator-runtime';
import Rete from "rete";
import ReactRenderPlugin from "rete-react-render-plugin";
import ConnectionPlugin from "rete-connection-plugin";
import AreaPlugin from "rete-area-plugin";
import { MyNode } from "./MyNode";

// Created sockets
var strSocket = new Rete.Socket("String");
var boolSocket = new Rete.Socket("Boolean");

class CheckboxControl extends Rete.Control{
  static component = ({ label, value, onChange }) => (
    <div>
      <input
      id={label.toLowerCase()}
      type="checkbox"
      defaultChecked={value}
      onChange={(e) => onChange(value)}
    />
    <label>{label}</label>
    </div>
  );

  constructor(emitter, key, node, data, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.component = CheckboxControl.component;

    console.log(data[key.toLowerCase()]);

    var initial;

    if (data[key.toLowerCase()] === undefined || data[key.toLowerCase()] === false) {
      initial = false;
    } else {
      initial = true;
    };

    node.data[key] = initial;
    this.props = {
      readonly,
      label: key,
      value: initial,
      onChange: (value, targetValue) => {
        this.toggleCheckbox(value);
        this.emitter.trigger("process");
      }
    };
  }

  toggleCheckbox(value){
    let newValue = (value === "on" || value === true) ? false : true;
    this.setValue(newValue);
  }

  setValue(val) {
    //console.log("setValue("+val+")");
    this.val = val;
    this.props.value = val;
    this.putData(this.key.toLowerCase(), val);
    this.update();
  }
}

class TextControl extends Rete.Control{
  static component = ({ value, onChange }) => (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  constructor(emitter, key, node, data, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.component = TextControl.component;

    const initial = data[key] || "";

    node.data[key] = initial;
    this.props = {
      readonly,
      value: initial,
      onChange: (v) => {
        this.setValue(v);
        this.emitter.trigger("process");
      }
    };
  }

  setValue(val) {
    this.props.value = val;
    this.putData(this.key, val);
    this.update();
  }
}

class SearchTwitterComponent extends Rete.Component {
  constructor() {
    super("Search Twitter");
    this.data.component = MyNode; // optional
  }
    
  builder(node) {
    //console.log(node);
    var ctrl = new TextControl(this.editor, "keywords", strSocket, node.data);
    var out = new Rete.Output("tweets", "Tweets", strSocket);

    return node
    .addControl(ctrl)
    .addOutput(out);
  }

  worker(node, inputs, outputs) {
    outputs["tweets"] = node.data.keywords;
  }
}
class GoogleSheets extends Rete.Component {
  constructor() {
    super("Write to Google Sheets");
    this.data.component = MyNode; // optional
  }

  builder(node) {
    var inp1 = new Rete.Input("tweets", "Tweets", strSocket);
    var out = new Rete.Output("tweets", "Tweets", strSocket);
    
    return node
      .addInput(inp1)
      .addOutput(out);
  }
  worker(node, inputs, outputs) {
    outputs["tweets"] = node.data;
  }
}
class ToneAnalyzerComponent extends Rete.Component {
  constructor() {
    super("Tone Analyzer");
    this.data.component = MyNode; // optional
  }
    
  builder(node) {
    var inp = new Rete.Input("tweets","Tweets",strSocket)
    var positiveCtrl = new CheckboxControl(this.editor, "Positive", boolSocket, node.data);
    var negativeCtrl = new CheckboxControl(this.editor, "Negative", boolSocket, node.data);
    var out = new Rete.Output("tweets", "Analyzed Tweets", strSocket);

    return node
    .addInput(inp)
    .addControl(positiveCtrl)
    .addControl(negativeCtrl)
    .addOutput(out);
  }

  worker(node, inputs, outputs) {
    outputs["tweets"] = node.data.keywords;
  }
}
class GoogleSlides extends Rete.Component {
  constructor() {
    super("Write to Google Slides");
    this.data.component = MyNode; // optional
  }

  builder(node) {
    var inp1 = new Rete.Input("tweets", "Tweets", strSocket);
    var out = new Rete.Output("tweets", "Tweets", strSocket);

    return node
      .addInput(inp1)
      .addOutput(out);
  }

  worker(node, inputs, outputs) {
      outputs["tweets"] = node.data
  }
}
export async function createEditor(container) {
  var components = [new SearchTwitterComponent(), new GoogleSheets(),new ToneAnalyzerComponent(), new GoogleSlides()];

  var editor = new Rete.NodeEditor("demo@0.1.0", container);
  editor.use(ConnectionPlugin);
  editor.use(ReactRenderPlugin);

  var engine = new Rete.Engine("demo@0.1.0");

  components.forEach((c) => { 
    editor.register(c);
    engine.register(c);
  });

  if (sessionStorage.getItem("workflowObj") !== null) {
    console.log("Found workflowObj in sessionStorage");
    console.log(sessionStorage.getItem("workflowObj"));
    await editor.fromJSON(JSON.parse(sessionStorage.getItem("workflowObj")));
  } else {
    console.log("loading default template");
    var twitter = await components[0].createNode();
    var googleSheets = await components[1].createNode();
    var toneAnalyzer= await components[2].createNode();
    var googleSlides =await components[3].createNode();
  
    
    twitter.position = [0, 800];
    googleSheets.position=[300,800];
    toneAnalyzer.position=[600,800];
    googleSlides.position=[900,800];
    
    editor.addNode(twitter);
    editor.addNode(googleSheets);
    editor.addNode(toneAnalyzer);
    editor.addNode(googleSlides);
  
    editor.connect(twitter.outputs.get("tweets"), googleSheets.inputs.get("tweets"));
    editor.connect(googleSheets.outputs.get("tweets"), toneAnalyzer.inputs.get("tweets"));
    editor.connect(toneAnalyzer.outputs.get("tweets"), googleSlides.inputs.get("tweets"));
    sessionStorage.setItem("workflowObj", JSON.stringify(editor.toJSON()));  
  }
  
  editor.on(
    "process connectioncreate connectioncreated connectionremove connectionremoved nodetranslated nodedraged",
    async () => {
      console.log("process");
      sessionStorage.setItem("workflowObj", JSON.stringify(editor.toJSON()));
      console.log(editor.toJSON());
      await engine.abort();
      await engine.process(editor.toJSON());
    }
  );

  editor.view.resize();
  AreaPlugin.zoomAt(editor, editor.nodes);

  sessionStorage.setItem("workflowObj", JSON.stringify(editor.toJSON()));  

  return editor;
}

export function useRete() {
  const [container, setContainer] = useState(null);
  const editorRef = useRef();

  useEffect(() => {
    if (container) {
      createEditor(container).then((value) => {
        console.log("created");
        editorRef.current = value;
      });
    }
  }, [container]);

  return [setContainer];
}
