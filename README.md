# Airy spot widget

A javascript widget designed to teach the concept of the Point spread function (PSF), for use in the [TU Delft BSc Optics textbook](https://books.open.tudelft.nl/home/catalog/book/232).

The widget follows the anywidget specification, so it may be invoked either in a jupyter notebook using python syntax, or directly in MyST Markdown using the anywidget directive.

## Usage (MyST)

Use the `anywidget` directive with the latest release:

```markdown
:::{anywidget} https://github.com/ssenhorst/airy-spot-widget/releases/latest/download/widget.js
:css: https://github.com/ssenhorst/airy-spot-widget/releases/latest/download/widget.css
:::
```

## Usage (python)

Add the repository as a dependency using your favorite package manager, e.g. uv:

```{code} bash
uv add airy_spot_widget
```

Then display the widget in your notebook using

```{code} python
from airy_spot_widget
widget = AirySpotWidget()
widget
```

## Example

The widget is available on [github pages](https://ssenhorst.github.io/airy-spot-widget/).