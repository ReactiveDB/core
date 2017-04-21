cp package.json README.md ./dist/cjs/
cd dist/cjs
sed -i '/\"main\":\ \"dist\/cjs\/index\.js\",/s/dist\/cjs\/index\.js/index\.js/g' package.json
sed -i '/\"module\":\ \"dist\/es6\/index\.js\",/d' package.json
cd ../../
npm publish dist/cjs/
