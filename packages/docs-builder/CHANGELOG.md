# Changelog

## [1.3.4](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.3.3...docs-builder-v1.3.4) (2024-12-12)


### Bug Fixes

* remove hardcoded slider range mappings ([#88](https://github.com/climateinteractive/docs-builder/issues/88)) ([6728140](https://github.com/climateinteractive/docs-builder/commit/67281402bc612a87960cc8161da32f4a4b386036)), closes [#87](https://github.com/climateinteractive/docs-builder/issues/87)

## [1.3.3](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.3.2...docs-builder-v1.3.3) (2024-12-12)


### Bug Fixes

* add range mappings for Czech and Portuguese ([#86](https://github.com/climateinteractive/docs-builder/issues/86)) ([55737af](https://github.com/climateinteractive/docs-builder/commit/55737af57ccb81a84963bad9ed31bbc505f160ac)), closes [#85](https://github.com/climateinteractive/docs-builder/issues/85)
* remove `removal_methods` table hack ([#84](https://github.com/climateinteractive/docs-builder/issues/84)) ([9541790](https://github.com/climateinteractive/docs-builder/commit/9541790b37a1ff5114b967f99c8ee51e1ddd95a7)), closes [#83](https://github.com/climateinteractive/docs-builder/issues/83)
* throw an error if text block contains HTML comment markup ([#81](https://github.com/climateinteractive/docs-builder/issues/81)) ([13c3807](https://github.com/climateinteractive/docs-builder/commit/13c3807cf872ad6d2c5153dd0a17503e9f286a0b)), closes [#80](https://github.com/climateinteractive/docs-builder/issues/80)

## [1.3.2](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.3.1...docs-builder-v1.3.2) (2024-12-11)


### Bug Fixes

* add endonym mapping for Czech language ([#78](https://github.com/climateinteractive/docs-builder/issues/78)) ([64b487a](https://github.com/climateinteractive/docs-builder/commit/64b487a13786295d933785bf273b927b6765666b)), closes [#77](https://github.com/climateinteractive/docs-builder/issues/77)

## [1.3.1](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.3.0...docs-builder-v1.3.1) (2024-11-08)


### Bug Fixes

* add endonym mappings for more languages ([#75](https://github.com/climateinteractive/docs-builder/issues/75)) ([f777788](https://github.com/climateinteractive/docs-builder/commit/f777788ef7a0e3434aa0ec0ee1201dab6f6fdeb6)), closes [#74](https://github.com/climateinteractive/docs-builder/issues/74)

## [1.3.0](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.10...docs-builder-v1.3.0) (2024-04-09)


### Features

* allow for specifying custom fragments to be included in head element ([#72](https://github.com/climateinteractive/docs-builder/issues/72)) ([a08da4f](https://github.com/climateinteractive/docs-builder/commit/a08da4f5d0a2e24ce9465ae1bc3cc305d26dd43c)), closes [#71](https://github.com/climateinteractive/docs-builder/issues/71)

## [1.2.10](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.9...docs-builder-v1.2.10) (2024-03-06)


### Bug Fixes

* correct file watcher to ignore saved.md files instead of saved.json ([#69](https://github.com/climateinteractive/docs-builder/issues/69)) ([8329406](https://github.com/climateinteractive/docs-builder/commit/8329406a31cbee112eca06385252bf22e893ee6c)), closes [#68](https://github.com/climateinteractive/docs-builder/issues/68)

## [1.2.9](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.8...docs-builder-v1.2.9) (2024-02-24)


### Bug Fixes

* drop node-html-parser dependency ([#67](https://github.com/climateinteractive/docs-builder/issues/67)) ([48e951c](https://github.com/climateinteractive/docs-builder/commit/48e951c425e67dc5dd6d1dedbc73b03c6c316e2e))
* only subscriptify chemical formulas that appear in text blocks ([#65](https://github.com/climateinteractive/docs-builder/issues/65)) ([d9fe245](https://github.com/climateinteractive/docs-builder/commit/d9fe245ee8df1daf6a0a75be06c009b72a275f9c)), closes [#62](https://github.com/climateinteractive/docs-builder/issues/62)

## [1.2.8](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.7...docs-builder-v1.2.8) (2024-01-30)


### Bug Fixes

* allow for page filenames including underscore and/or dash when reading saved.md ([#57](https://github.com/climateinteractive/docs-builder/issues/57)) ([b59f018](https://github.com/climateinteractive/docs-builder/commit/b59f018054867cb100acaccd74c4e5a40b6dc96c)), closes [#56](https://github.com/climateinteractive/docs-builder/issues/56)

## [1.2.7](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.6...docs-builder-v1.2.7) (2024-01-29)


### Bug Fixes

* include H2O, O2, and O3 in list of automatically subscripted chemicals ([#54](https://github.com/climateinteractive/docs-builder/issues/54)) ([5e08bb3](https://github.com/climateinteractive/docs-builder/commit/5e08bb3f736ee0c3d0ea8297f1665d6bd22581e0)), closes [#53](https://github.com/climateinteractive/docs-builder/issues/53)

## [1.2.6](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.5...docs-builder-v1.2.6) (2023-12-22)


### Bug Fixes

* handle child token when converting text tokens back into Markdown ([#51](https://github.com/climateinteractive/docs-builder/issues/51)) ([558aa9b](https://github.com/climateinteractive/docs-builder/commit/558aa9b7675fcad98c4098b745d5ca80ac9cee29)), closes [#47](https://github.com/climateinteractive/docs-builder/issues/47)

## [1.2.5](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.4...docs-builder-v1.2.5) (2023-12-21)


### Bug Fixes

* read/write saved.md instead of saved.json ([#49](https://github.com/climateinteractive/docs-builder/issues/49)) ([152e894](https://github.com/climateinteractive/docs-builder/commit/152e894b0eb54ebc54c1c216f3739053ea61ebd1)), closes [#48](https://github.com/climateinteractive/docs-builder/issues/48)

## [1.2.4](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.3...docs-builder-v1.2.4) (2023-08-10)


### Bug Fixes

* include 3rd-level section headers in sidebar outline ([#44](https://github.com/climateinteractive/docs-builder/issues/44)) ([a3f7c56](https://github.com/climateinteractive/docs-builder/commit/a3f7c5618d881885404e8949d3f366baca7a24b8)), closes [#43](https://github.com/climateinteractive/docs-builder/issues/43)

## [1.2.3](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.2...docs-builder-v1.2.3) (2023-06-08)


### Bug Fixes

* include CF4 in list of automatically subscripted chemicals ([#37](https://github.com/climateinteractive/docs-builder/issues/37)) ([1e6ae0e](https://github.com/climateinteractive/docs-builder/commit/1e6ae0edcb55d10239ca6179e04f8782ad208dec)), closes [#36](https://github.com/climateinteractive/docs-builder/issues/36)

## [1.2.2](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.1...docs-builder-v1.2.2) (2023-05-30)


### Bug Fixes

* correct link transformer to work when there are multiple links in one block ([#34](https://github.com/climateinteractive/docs-builder/issues/34)) ([ef5af72](https://github.com/climateinteractive/docs-builder/commit/ef5af721fbd2e6802e270913308af67436cfd8a7)), closes [#33](https://github.com/climateinteractive/docs-builder/issues/33)

## [1.2.1](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.2.0...docs-builder-v1.2.1) (2023-05-23)


### Bug Fixes

* only include Next/Previous links for default template ([#30](https://github.com/climateinteractive/docs-builder/issues/30)) ([894fe8a](https://github.com/climateinteractive/docs-builder/commit/894fe8aa994c18002bad8436bc6fa38d65dc945d)), closes [#29](https://github.com/climateinteractive/docs-builder/issues/29)

## [1.2.0](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.1.0...docs-builder-v1.2.0) (2023-05-23)


### Features

* add Next/Previous pagination controls to each page ([#27](https://github.com/climateinteractive/docs-builder/issues/27)) ([8209b98](https://github.com/climateinteractive/docs-builder/commit/8209b989d72ac8b02c904290988329a371dfec8e)), closes [#22](https://github.com/climateinteractive/docs-builder/issues/22)

## [1.1.0](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.0.2...docs-builder-v1.1.0) (2023-04-05)


### Features

* copy all assets found in sourceDir and use ${ASSET-xyz} to reference them in templates ([#25](https://github.com/climateinteractive/docs-builder/issues/25)) ([eb016d5](https://github.com/climateinteractive/docs-builder/commit/eb016d51af421093d1a3ec802ec03521d8974ab1)), closes [#24](https://github.com/climateinteractive/docs-builder/issues/24)

## [1.0.2](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.0.1...docs-builder-v1.0.2) (2023-02-07)


### Bug Fixes

* downgrade to puppeteer 18.x to workaround cache issue ([#19](https://github.com/climateinteractive/docs-builder/issues/19)) ([14b4ed5](https://github.com/climateinteractive/docs-builder/commit/14b4ed5654b9804b7a7e474064df5fdeaf3633f6)), closes [#18](https://github.com/climateinteractive/docs-builder/issues/18)
* treat trailing spaces (line break) as an error ([#21](https://github.com/climateinteractive/docs-builder/issues/21)) ([7f0655c](https://github.com/climateinteractive/docs-builder/commit/7f0655c6b1b65dbae574c82fc47fc986af1b1a84)), closes [#16](https://github.com/climateinteractive/docs-builder/issues/16)
* upgrade puppeteer to 19.6.2 ([#12](https://github.com/climateinteractive/docs-builder/issues/12)) ([22ce42a](https://github.com/climateinteractive/docs-builder/commit/22ce42a2961a1965b1ad802eaa4631c652358889)), closes [#11](https://github.com/climateinteractive/docs-builder/issues/11)
* use scoped error messages in more places ([#17](https://github.com/climateinteractive/docs-builder/issues/17)) ([ec51a76](https://github.com/climateinteractive/docs-builder/commit/ec51a7650e80c8bb04c31acda906b2473a88ecce)), closes [#15](https://github.com/climateinteractive/docs-builder/issues/15)

## [1.0.1](https://github.com/climateinteractive/docs-builder/compare/docs-builder-v1.0.0...docs-builder-v1.0.1) (2023-01-30)


### Bug Fixes

* add support for code blocks ([#7](https://github.com/climateinteractive/docs-builder/issues/7)) ([4325737](https://github.com/climateinteractive/docs-builder/commit/43257371fcc01ca6043f76cfd507648522464690)), closes [#5](https://github.com/climateinteractive/docs-builder/issues/5)
* allow for simpler project structure ([#10](https://github.com/climateinteractive/docs-builder/issues/10)) ([a5c5db9](https://github.com/climateinteractive/docs-builder/commit/a5c5db98c4a2720b2137ea01c10a931175143024)), closes [#6](https://github.com/climateinteractive/docs-builder/issues/6)
* only generate base en.po file if project is translated ([#9](https://github.com/climateinteractive/docs-builder/issues/9)) ([2e91954](https://github.com/climateinteractive/docs-builder/commit/2e919545dad9efc29296c4529fb13f4949178fda)), closes [#4](https://github.com/climateinteractive/docs-builder/issues/4)

## 1.0.0 (2022-08-11)


### Features

* add initial docs-builder and example project ([#2](https://github.com/climateinteractive/docs-builder/issues/2)) ([7aa841e](https://github.com/climateinteractive/docs-builder/commit/7aa841ec77bc16e317af10c3eef921b47a3725c9)), closes [#1](https://github.com/climateinteractive/docs-builder/issues/1)
