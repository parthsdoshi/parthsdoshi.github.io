import React from "react"
import { useStaticQuery, graphql } from "gatsby"
import Img from "gatsby-image"

/*
 * This component is built using `gatsby-image` to automatically serve optimized
 * images with lazy loading and reduced file sizes. The image is loaded using a
 * `useStaticQuery`, which allows us to load the image from directly within this
 * component, rather than having to pass the image data down from pages.
 *
 * For more information, see the docs:
 * - `gatsby-image`: https://gatsby.dev/gatsby-image
 * - `useStaticQuery`: https://www.gatsbyjs.org/docs/use-static-query/
 */

const CiscoLogo = () => {
  const data = useStaticQuery(graphql`
    query {
      strapiWorkExperience(slug: {eq: "cisco"}) {
        logo {
          childImageSharp {
            fluid {
              ...GatsbyImageSharpFluid_withWebp_tracedSVG
            }
          }
        }
      }
    }
  `)
  let image = data.strapiWorkExperience.logo

  return <Img fluid={image.childImageSharp.fluid} alt="A picture of Cisco's logo." />
}

export default CiscoLogo;