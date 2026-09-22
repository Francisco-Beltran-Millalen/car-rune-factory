// Typedefs JSDoc de los contratos (docs/CONTRATOS.md). Este archivo no exporta código.

/**
 * @typedef {Object} Model
 * @property {Object} params    Lo escriben sólo los controles de la UI y los tests (§2).
 * @property {Object} faults    boolean | number 0..1 | string enum.
 * @property {Object} state     Sólo lectura fuera del modelo (§2).
 * @property {(dt:number)=>void} step  Avanza dt segundos simulados; estable con dt ≤ 0.002.
 * @property {()=>void} reset
 * @property {Record<string, (...args:any[])=>void>} actions
 * @property {number} time      Tiempo simulado acumulado (s).
 */

/**
 * @typedef {Object} ViewContext
 * @property {SVGSVGElement} svg
 * @property {Model} model
 * @property {(partId:string)=>void} selectPart
 */

/**
 * @typedef {Object} View
 * @property {(dt:number)=>void} update  dt = segundos reales × timeScale.
 * @property {(partId:string|null)=>void} highlight
 * @property {()=>void} destroy
 */

/**
 * @typedef {Object} ControlSpec
 * @property {'slider'|'toggle'|'select'|'button'} type
 * @property {string} [key]      Clave en model.params (slider/toggle/select).
 * @property {string} [action]   Nombre en model.actions (button).
 * @property {string} label
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} [unit]
 * @property {string} [group]
 * @property {{value:any,label:string}[]} [options]
 * @property {(model:Model)=>boolean} [disabledWhen]
 */

/**
 * @typedef {Object} FaultSpec
 * @property {string} key
 * @property {string} label
 * @property {'severity'|'toggle'|'enum'} kind
 * @property {string} [description]
 * @property {{value:any,label:string}[]} [options]
 */

/**
 * @typedef {Object} ReadoutSpec
 * @property {string} id
 * @property {string} label
 * @property {string} unit
 * @property {number} [decimals]
 * @property {(state:Object)=>number} get
 * @property {{min:number,max:number,green?:[number,number]}} [gauge]
 * @property {boolean} [history]
 */

/**
 * @typedef {Object} PartInfo
 * @property {string} name
 * @property {string} what
 * @property {string} why
 * @property {string} how
 * @property {string[]} failures
 */

/**
 * @typedef {Object} Narration
 * @property {'info'|'warn'|'bad'} level
 * @property {string} text
 */

/**
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {Object} [params]
 * @property {Object} [faults]
 * @property {Object} [setup]   Acciones a invocar: { actionName: args[] }.
 * @property {string} [note]
 */

/**
 * @typedef {Object} ModuleDescriptor
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {number} order
 * @property {[number,number,number,number]} viewBox
 * @property {()=>Model} createModel
 * @property {(ctx:ViewContext)=>View} createView
 * @property {ControlSpec[]} controls
 * @property {FaultSpec[]} faults
 * @property {ReadoutSpec[]} readouts
 * @property {Record<string, PartInfo>} parts
 * @property {(model:Model)=>Narration[]} narrate
 * @property {Preset[]} [presets]
 */

export {};
