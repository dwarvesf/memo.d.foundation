---
title: "#64 - Finished the first Cycle of 2021"
date: 2021-02-27
description: Discover key updates from the Jan/Feb changelog, including Discord’s switch from Go to Rust for better performance and new tools for personal branding.
last_edited: "2025-04-07T00:00:00.000Z"
---

### Jan/Feb Changelog

I’ve crafted up some key goals we’re (hopefully) to check off in 2021, mostly our plan is tweaking and making this a better place to work and be a part of. During our next Dwarves Radio Talk, the Ops team will walk through this a bit, and if you have anything to merge in, please do. We welcome all the ideas.

Read more at Jan/Feb Changelog

### How many years have you been here?

Wanna see how old you’ve gotten in this woodland? Check out the latest upgrade Huy G brought us as d.foundation/about. Any personal link/ info to add in? Drop Huy N a message.

![](assets/notion-image-1744007058376-zl8ma.webp)

### Dwarves Radio #5: Radar Update and Profile Convention

A wrap up of our decision to officially adopt Earthly and Upptime into the tech practices. Also, a bit sharing on how creating a professional and consistent profile can benefit personal branding. See more at: Dwarves Radio Talk #5

Nam T is working on continuing this series of Soft Skills, heard that she plans on having one of our former Dwarves on our next radio talk.

### News recap

Discord switches from Go to Rust

The main purpose of Discord is getting snappy and, yesh, a bit irritating all the time. To meet this expectation, it requires a quick read state. Discord receives a big volume of ReadState per user per channel to monitor and track if the user has or hasn’t read the message. This service continuously needs to update, adjust and reset. Optimizing its performance is considered as the top priority. Golang, unfortunately, failed at this due to its garbage collector and memory management model. Go’s garbage collector runs so often to find any memory that has no references. Given this, instead of freeing immediately after the memory is out of use, it simply takes more time to assess what memory is truly out of use and slow the whole thing down. Through assessment, it takes Go like 2 minutes at minimum to finish its determination per memory. A freaking large spikes.

Rust, on the other hand, does not have garbage collection. Rust keeps track of who can read and write to memory. It knows when the program uses memory and immediately frees the memory once it is no longer needed. This traces back to the issue: Which programming language is better than others? The answer is what kind of problem that needs to be solved. Discord is a service that requires strong performance; Rust> Go is apparently. It’s about controlling and managing the memory to reduce redundancy. Firefox also made the same move earlier this year.
