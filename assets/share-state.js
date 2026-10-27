/* URL-only presentation state. Never serializes data, feedback, or user identifiers. */
(function (root) {
  "use strict";
  const defaults = Object.freeze({
    layer:"medicines", view:"all", display:"rate", threshold:"100",
    medicine:"any", status:"A", country:""
  });
  const allowed = {
    layer:["medicines","tb-incidence","tb-smoking"],
    view:["all","full","0","1","2","3"],
    display:["rate","access"],
    threshold:["100","200","400"],
    medicine:["any","full","0","1","2","3"],
    status:["A","U","X"]
  };
  function read(search, countryIds) {
    const params = new URLSearchParams(search);
    const state = {...defaults};
    for (const [key, options] of Object.entries(allowed)) {
      const value = params.get(key);
      if (value !== null && options.includes(value)) state[key] = value;
    }
    const country = params.get("country");
    if (country && /^[A-Z]{3}$/.test(country) && countryIds.has(country)) state.country = country;
    return state;
  }
  function serialize(state) {
    const params = new URLSearchParams();
    for (const [key, options] of Object.entries(allowed)) {
      if (options.includes(String(state[key])) && String(state[key]) !== defaults[key])
        params.set(key, String(state[key]));
    }
    if (/^[A-Z]{3}$/.test(state.country || "")) params.set("country", state.country);
    return params.toString();
  }
  root.MapShareState = Object.freeze({defaults,read,serialize});
})(window);
