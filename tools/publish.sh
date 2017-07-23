cp package.json README.md ./dist/cjs/
cp package.json README.md ./dist/es/
cd dist/cjs
sed -i '/\"main\":\ \"dist\/cjs\/index\.js\",/s/dist\/cjs\/index\.js/index\.js/g' package.json
sed -i '/\"module\":\ \"dist\/es\/index\.js\",/d' package.json
cd ../es/
sed -i '/\"main\":\ \"dist\/cjs\/index\.js\",/s/dist\/cjs\/index\.js/index\.js/g' package.json
sed -i '/\"module\":\ \"dist\/es\/index\.js\",/d' package.json
sed -i '/\"name\":\ \"reactivedb\",/s/reactivedb/reactivedb-es/g' package.json
cd ../..
npm publish dist/cjs/
npm publish dist/es/
