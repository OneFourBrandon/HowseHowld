// The slate stylesheets, as one module. It has exactly one importer,
// loadSlateStyles in src/lib/switchDesign.ts, which loads it on demand and
// then confirms it arrived. Nothing else may import it: a second importer
// would let the bundler report the stylesheet as loaded before it has been.
// Both files expect to come after index.css, which a dynamic import guarantees.
import './slate.css'
import './charts.css'
