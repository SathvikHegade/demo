import fs from 'fs';
let C = fs.readFileSync('components/DatasetQualityAnalyzer.tsx', 'utf8');
C = C.replace(/<\/section>([\s\S]*?)<\/div>\s+\);/g, '</section>\n      {report && <DemoDashboard report={report} />}\n    </div>\n  );');

fs.writeFileSync('components/DatasetQualityAnalyzer.tsx', C);
