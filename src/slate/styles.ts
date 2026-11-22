// The slate stylesheets, as one module. It is imported dynamically so that it
// is only fetched once someone switches the design on. Both files expect to
// come after index.css, which a dynamic import guarantees.
import './slate.css'
import './charts.css'
