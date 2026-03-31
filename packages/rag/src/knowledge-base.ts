import type { WcagChunk } from "./chunker";

/**
 * Comprehensive WCAG 2.2 knowledge base with all criteria,
 * sufficient techniques, advisory techniques, and common failures.
 */
export class WcagKnowledgeBase {
  private documents: Map<
    string,
    { title: string; content: string; metadata: Record<string, string> }
  > = new Map();

  constructor() {
    this.loadCoreCriteria();
  }

  getDocuments(): Array<{
    id: string;
    title: string;
    content: string;
    source: string;
    metadata: Record<string, string>;
  }> {
    return Array.from(this.documents.entries()).map(([id, doc]) => ({
      id,
      title: doc.title,
      content: doc.content,
      source: "WCAG 2.2",
      metadata: doc.metadata,
    }));
  }

  addCriterion(
    id: string,
    title: string,
    level: string,
    principle: string,
    description: string,
    techniques: {
      type: "sufficient" | "advisory" | "failure";
      id: string;
      title: string;
      description: string;
    }[],
  ): void {
    let content = `## ${title} (${id})\n\n`;
    content += `**Level:** ${level}\n`;
    content += `**Principle:** ${principle}\n\n`;
    content += `${description}\n\n`;

    const sufficient = techniques.filter((t) => t.type === "sufficient");
    const advisory = techniques.filter((t) => t.type === "advisory");
    const failures = techniques.filter((t) => t.type === "failure");

    if (sufficient.length > 0) {
      content += `### Sufficient Techniques\n\n`;
      for (const t of sufficient) {
        content += `- **${t.id}:** ${t.title} — ${t.description}\n`;
      }
      content += "\n";
    }

    if (advisory.length > 0) {
      content += `### Advisory Techniques\n\n`;
      for (const t of advisory) {
        content += `- **${t.id}:** ${t.title} — ${t.description}\n`;
      }
      content += "\n";
    }

    if (failures.length > 0) {
      content += `### Common Failures\n\n`;
      for (const t of failures) {
        content += `- **${t.id}:** ${t.title} — ${t.description}\n`;
      }
      content += "\n";
    }

    this.documents.set(id, {
      title,
      content,
      metadata: {
        criterionId: id,
        criterionName: title,
        level,
        principle,
      },
    });
  }

  private loadCoreCriteria(): void {
    this.addCriterion(
      "wcag111",
      "Non-text Content",
      "A",
      "Perceivable",
      "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose, except for specific situations (controls, input, time-based media, test, sensory, CAPTCHA, decoration).",
      [
        {
          type: "sufficient",
          id: "G94",
          title: "Provide short text alternative",
          description:
            "Ensuring short text alternatives serve the same purpose as non-text content",
        },
        {
          type: "sufficient",
          id: "G95",
          title: "Provide short descriptions",
          description:
            "Providing short text alternatives that provide a brief description of the non-text content",
        },
        {
          type: "sufficient",
          id: "H2",
          title: "Img alt text",
          description: "Using the alt attribute on img elements",
        },
        {
          type: "sufficient",
          id: "H37",
          title: "Alt on img elements",
          description: "Using alt attributes on img elements",
        },
        {
          type: "sufficient",
          id: "H67",
          title: "Img with empty alt and no title",
          description:
            "Using null alt text and no title attribute on img elements for images that AT should ignore",
        },
        {
          type: "advisory",
          id: "C8",
          title: "CSS background images",
          description:
            "Using CSS letter-spacing to control spacing within a word",
        },
        {
          type: "failure",
          id: "F3",
          title: "Using CSS to include images",
          description:
            "Failure of SC 1.1.1 due to using CSS to include images that convey important information",
        },
        {
          type: "failure",
          id: "F13",
          title: "Missing alt and text",
          description:
            "Failure of SC 1.1.1 and 1.4.1 due to having a text alternative that does not include information conveyed by color differences",
        },
        {
          type: "failure",
          id: "F20",
          title: "Not updating text alternatives",
          description:
            "Failure of SC 1.1.1 and 4.1.2 due to not updating text alternatives when changes to non-text content occur",
        },
        {
          type: "failure",
          id: "F30",
          title: "Missing alt attribute",
          description:
            "Failure of SC 1.1.1 due to using non-text content without a text alternative for the img element",
        },
        {
          type: "failure",
          id: "F38",
          title: "Not marking up decorative images",
          description:
            "Failure of SC 1.1.1 due to not marking up decorative images in HTML in a way that allows assistive technology to ignore them",
        },
        {
          type: "failure",
          id: "F39",
          title: "Missing alt for img",
          description:
            "Failure of SC 1.1.1 due to providing a text alternative that is not null for an image that assistive technology should ignore",
        },
        {
          type: "failure",
          id: "F65",
          title: "Missing alt attribute",
          description:
            "Failure of SC 1.1.1 due to omitting the alt attribute or text alternative on img elements, area elements, and input elements of type image",
        },
        {
          type: "failure",
          id: "F67",
          title: "Longdesc not providing description",
          description:
            "Failure of SC 1.1.1 due to providing long description for non-text content that does not serve the same purpose or does not present the same information",
        },
      ],
    );

    this.addCriterion(
      "wcag131",
      "Info and Relationships",
      "A",
      "Perceivable",
      "Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text.",
      [
        {
          type: "sufficient",
          id: "G115",
          title: "Using semantic elements",
          description: "Using semantic elements to mark up structure",
        },
        {
          type: "sufficient",
          id: "H42",
          title: "Using h1-h6 for headings",
          description: "Using h1-h6 to identify headings",
        },
        {
          type: "sufficient",
          id: "H43",
          title: "Using id and headers",
          description:
            "Using id and headers attributes to associate data cells with header cells in data tables",
        },
        {
          type: "sufficient",
          id: "H44",
          title: "Using label elements",
          description:
            "Using label elements to associate text labels with form controls",
        },
        {
          type: "sufficient",
          id: "H65",
          title: "Using title for form controls",
          description:
            "Using the title attribute to identify form controls when the label element cannot be used",
        },
        {
          type: "sufficient",
          id: "H71",
          title: "Using fieldset and legend",
          description:
            "Providing a description for groups of form controls using fieldset and legend elements",
        },
        {
          type: "failure",
          id: "F2",
          title: "Using CSS to change meaning",
          description:
            "Failure of SC 1.3.1 due to using changes in CSS presentation to convey information without using the appropriate markup or text",
        },
        {
          type: "failure",
          id: "F33",
          title: "Not using structural markup",
          description:
            "Failure of SC 1.3.1 due to using CSS to create visual formatting that could be confused with structural markup",
        },
        {
          type: "failure",
          id: "F42",
          title: "Using scripting events",
          description:
            "Failure of SC 1.3.1 and 2.1.1 when using scripting events to emulate links",
        },
        {
          type: "failure",
          id: "F43",
          title: "Missing structural markup",
          description:
            "Failure of SC 1.3.1 due to using structural markup in a way that does not represent relationships in the content",
        },
        {
          type: "failure",
          id: "F68",
          title: "Missing label association",
          description:
            "Failure of SC 1.3.1 and 4.1.2 due to a user interface component not having a programmatically determined name",
        },
        {
          type: "failure",
          id: "F87",
          title: "Missing row/column headers",
          description:
            "Failure of SC 1.3.1 due to inserting non-decorative content by using :before and :after pseudo-elements and the content property",
        },
        {
          type: "failure",
          id: "F90",
          title: "Missing caption association",
          description:
            "Failure of SC 1.3.1 for incorrectly associating table headers and content via the headers attribute",
        },
        {
          type: "failure",
          id: "F91",
          title: "Missing row/column headers",
          description:
            "Failure of SC 1.3.1 for not correctly marking up table headers",
        },
      ],
    );

    this.addCriterion(
      "wcag143",
      "Contrast (Minimum)",
      "AA",
      "Perceivable",
      "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1, except for large text (3:1), incidental text, or logotypes.",
      [
        {
          type: "sufficient",
          id: "G17",
          title: "Ensuring contrast",
          description:
            "Ensuring that a contrast ratio of at least 7:1 exists between text and background behind the text",
        },
        {
          type: "sufficient",
          id: "G18",
          title: "Ensuring 4.5:1 contrast",
          description:
            "Ensuring that a contrast ratio of at least 4.5:1 exists between text and background behind the text",
        },
        {
          type: "sufficient",
          id: "G145",
          title: "Ensuring 3:1 for large text",
          description:
            "Ensuring that a contrast ratio of at least 3:1 exists between text and background behind the text for large-scale text",
        },
        {
          type: "sufficient",
          id: "G174",
          title: "User-adjustable contrast",
          description:
            "Providing a control with a sufficient contrast ratio that allows users to switch to a presentation that uses sufficient contrast",
        },
        {
          type: "advisory",
          id: "C23",
          title: "Specifying text and background",
          description:
            "Specifying text and background colors of secondary content such as banners, features, and navigation in CSS while not specifying text and background colors of the main content",
        },
        {
          type: "failure",
          id: "F24",
          title: "Changing foreground colors",
          description:
            "Failure of SC 1.4.3, SC 1.4.6 and SC 1.4.8 due to specifying foreground colors without specifying background colors or vice versa",
        },
        {
          type: "failure",
          id: "F83",
          title: "Insufficient contrast",
          description:
            "Failure of SC 1.4.3 and SC 1.4.6 due to using background images that do not provide sufficient contrast with foreground text",
        },
      ],
    );

    this.addCriterion(
      "wcag242",
      "Page Titled",
      "A",
      "Operable",
      "Web pages have titles that describe topic or purpose.",
      [
        {
          type: "sufficient",
          id: "G88",
          title: "Descriptive titles",
          description: "Providing descriptive titles for Web pages",
        },
        {
          type: "sufficient",
          id: "H25",
          title: "Title element",
          description: "Providing a title using the title element",
        },
        {
          type: "failure",
          id: "F25",
          title: "Missing title",
          description:
            "Failure of SC 2.4.2 due to the title of a Web page not identifying the contents or purpose of the Web page",
        },
      ],
    );

    this.addCriterion(
      "wcag244",
      "Link Purpose (In Context)",
      "A",
      "Operable",
      "The purpose of each link can be determined from the link text alone or from the link text together with its programmatically determined link context, except where the purpose of the link would be ambiguous to users in general.",
      [
        {
          type: "sufficient",
          id: "G53",
          title: "Link text with context",
          description:
            "Identifying the purpose of a link using link text combined with the text of the enclosing sentence",
        },
        {
          type: "sufficient",
          id: "H30",
          title: "Descriptive link text",
          description:
            "Providing link text that describes the purpose of a link for anchor elements",
        },
        {
          type: "sufficient",
          id: "H77",
          title: "Link text with list context",
          description:
            "Identifying the purpose of a link using link text combined with its enclosing list item",
        },
        {
          type: "sufficient",
          id: "H78",
          title: "Link text with paragraph context",
          description:
            "Identifying the purpose of a link using link text combined with its enclosing paragraph",
        },
        {
          type: "sufficient",
          id: "H79",
          title: "Link text with table context",
          description:
            "Identifying the purpose of a link in a data table using the link text combined with its enclosing table cell",
        },
        {
          type: "sufficient",
          id: "H81",
          title: "Nested list link context",
          description:
            "Identifying the purpose of a link in a nested list using link text combined with the parent list item",
        },
        {
          type: "failure",
          id: "F63",
          title: "Generic link text",
          description:
            "Failure of SC 2.4.4 due to providing link context only in content that is not related to the link",
        },
        {
          type: "failure",
          id: "F89",
          title: "Null alt on informative image links",
          description:
            "Failure of SC 2.4.4, 2.4.9 and 4.1.2 due to using null alt on an image where the image is the only content in a link",
        },
      ],
    );

    this.addCriterion(
      "wcag246",
      "Headings and Labels",
      "AA",
      "Operable",
      "Headings and labels describe topic or purpose.",
      [
        {
          type: "sufficient",
          id: "G130",
          title: "Descriptive headings",
          description: "Providing descriptive headings",
        },
        {
          type: "sufficient",
          id: "G131",
          title: "Descriptive labels",
          description: "Providing descriptive labels",
        },
        {
          type: "advisory",
          id: "G141",
          title: "Organizing headings",
          description: "Organizing a page of content into headings",
        },
      ],
    );

    this.addCriterion(
      "wcag311",
      "Language of Page",
      "A",
      "Understandable",
      "The default human language of each Web page can be programmatically determined.",
      [
        {
          type: "sufficient",
          id: "H57",
          title: "Using lang attribute",
          description: "Using the language attributes on the html element",
        },
        {
          type: "failure",
          id: "F26",
          title: "Missing lang attribute",
          description:
            "Failure of SC 3.1.1 due to using the alt attribute on an area element to specify text that is not in the default human language of the page",
        },
      ],
    );

    this.addCriterion(
      "wcag332",
      "Labels or Instructions",
      "A",
      "Understandable",
      "Labels or instructions are provided when content requires user input.",
      [
        {
          type: "sufficient",
          id: "G131",
          title: "Descriptive labels",
          description: "Providing descriptive labels",
        },
        {
          type: "sufficient",
          id: "G162",
          title: "Positioning labels",
          description:
            "Positioning labels to maximize predictability of relationships",
        },
        {
          type: "sufficient",
          id: "G83",
          title: "Required fields",
          description:
            "Providing text descriptions to identify required fields that were not completed",
        },
        {
          type: "sufficient",
          id: "H44",
          title: "Label elements",
          description:
            "Using label elements to associate text labels with form controls",
        },
        {
          type: "sufficient",
          id: "H71",
          title: "Fieldset and legend",
          description:
            "Providing a description for groups of form controls using fieldset and legend elements",
        },
        {
          type: "failure",
          id: "F82",
          title: "Missing visual label",
          description:
            "Failure of SC 3.3.2 by visually formatting a set of phone number fields but not including a text label",
        },
      ],
    );

    this.addCriterion(
      "wcag412",
      "Name, Role, Value",
      "A",
      "Robust",
      "For all user interface components, the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents, including assistive technologies.",
      [
        {
          type: "sufficient",
          id: "G10",
          title: "Creating components using WAI-ARIA",
          description:
            "Creating components using WAI-ARIA to enable programmatic access to custom widgets",
        },
        {
          type: "sufficient",
          id: "G108",
          title: "Using WAI-ARIA for name/role",
          description:
            "Using WAI-ARIA to expose the name and role, allow user-settable properties to be directly set, and provide notification of changes",
        },
        {
          type: "sufficient",
          id: "H44",
          title: "Label elements",
          description:
            "Using label elements to associate text labels with form controls",
        },
        {
          type: "sufficient",
          id: "H64",
          title: "Using the title attribute",
          description:
            "Using the title attribute of the frame and iframe elements",
        },
        {
          type: "sufficient",
          id: "H65",
          title: "Using title for controls",
          description:
            "Using the title attribute to identify form controls when the label element cannot be used",
        },
        {
          type: "sufficient",
          id: "H88",
          title: "Using HTML according to spec",
          description: "Using HTML according to spec",
        },
        {
          type: "failure",
          id: "F59",
          title: "Using scripts to change text",
          description:
            "Failure of SC 4.1.2 due to using script to make div or span a user interface control in HTML without providing a role for the control",
        },
        {
          type: "failure",
          id: "F68",
          title: "Missing name association",
          description:
            "Failure of SC 1.3.1 and 4.1.2 due to a user interface component not having a programmatically determined name",
        },
        {
          type: "failure",
          id: "F79",
          title: "Missing state notification",
          description:
            "Failure of SC 4.1.2 due to the focus state of a user interface component not being programmatically determinable or no notification of change of focus state available",
        },
        {
          type: "failure",
          id: "F86",
          title: "Missing name for controls",
          description:
            "Failure of SC 4.1.2 due to not providing names for each part of a multi-part form field",
        },
      ],
    );

    this.addCriterion(
      "wcag241",
      "Bypass Blocks",
      "A",
      "Operable",
      "A mechanism is available to bypass blocks of content that are repeated on multiple Web pages.",
      [
        {
          type: "sufficient",
          id: "G1",
          title: "Adding a link to skip",
          description:
            "Adding a link at the top of each page that goes directly to the main content area",
        },
        {
          type: "sufficient",
          id: "G123",
          title: "Skip link at beginning",
          description:
            "Adding a link at the beginning of a block of repeated content to go to the end of the block",
        },
        {
          type: "sufficient",
          id: "G124",
          title: "Links to different types",
          description: "Listing links to all different types of content areas",
        },
        {
          type: "sufficient",
          id: "H69",
          title: "Using heading elements",
          description:
            "Providing heading elements at the beginning of each section of content",
        },
        {
          type: "sufficient",
          id: "H70",
          title: "Using frame elements",
          description:
            "Using frame elements to group blocks of repeated material",
        },
      ],
    );
  }
}
